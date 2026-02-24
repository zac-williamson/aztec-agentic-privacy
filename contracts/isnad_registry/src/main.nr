mod attestation_note;
mod auth_cert_note;
mod credential_note;
mod tests;
mod utils;

use aztec::macros::aztec;

/// IsnadRegistry -- ZK Skill Attestation and Credential Registry for AI agents
///
/// The Isnad Chain: provenance authentication for skills, powered by zero-knowledge proofs.
/// "Isnad" (Arabic) means "chain of authority" -- every trusted attestation traces an unbroken
/// chain back to a root of trust through explicit vouching.
///
/// === Chain-of-Trust Model ===
///
/// Authorization is proven by HOLDING a private AuthCertNote. An address proves it is an
/// authorized attestor by presenting its AuthCertNote in the ZK circuit. The certificate
/// is committed to the note hash tree -- its contents cannot be forged.
///
/// Only the CONTRACT ADMIN can create root certificates (depth=0) via add_root_attestor().
/// Any authorized attestor can vouch a new member via vouch(), which creates a cert at
/// (voucher_depth + 1). The admin check is enforced in the public phase (_verify_and_register_root),
/// so non-admin private calls to add_root_attestor will revert in the public phase, and
/// the transaction (including the forged cert) is atomically discarded.
///
/// The chain is PUBLICLY VISIBLE (is_authorized, attestor_depth) for external verification.
/// The attestation CONTENT (what each person attested) remains PRIVATE.
///
/// === Trust Score Weighting ===
///
/// Attestor depth determines how much each attestation contributes to a skill's trust score:
///   depth 0 (root):     effective_quality = quality * 4
///   depth 1:            effective_quality = quality * 3
///   depth 2:            effective_quality = quality * 2
///   depth 3+:           effective_quality = quality * 1
///
/// Root attestors carry the most weight -- they are the anchors of the chain.
///
/// === Private State (encrypted, in Note Hash Tree -- visible only to owners) ===
///   - auth_certs:   each authorized attestor's certificate (proves chain membership + depth)
///   - attestations: each auditor's personal record of what they have attested
///   - credentials:  each agent's vault of API keys and secrets
///
/// === Public State (visible to all, on-chain) ===
///   - admin:              who can add root attestors
///   - is_authorized:      whether an address is in the Isnad chain
///   - attestor_depth:     how many vouch steps from a root
///   - trust_scores:       aggregate weighted quality score per skill hash
///   - attestation_counts: how many unique authorized auditors have attested a skill
///   - quarantine_flags:   emergency override -- quarantined skills return score 0
///
/// === Quarantine Model ===
///
/// quarantine(skill_hash) is an EMERGENCY KILL SWITCH for known-malicious skills.
/// When quarantined, get_trust_score() returns 0 regardless of accumulated attestations.
/// Quarantined skills are immediately rejected by agents checking trust scores.
///
/// This is DISTINCT from revoke_attestation() (individual retraction). Quarantine:
///   - Is admin-only (not per-auditor)
///   - Overrides the score rather than removing individual contributions
///   - Preserves the underlying score -- unquarantine() restores it fully
///   - Takes effect instantly for all consumers of get_trust_score()
///
/// The attestation_count remains visible even when quarantined, so observers can see
/// that attestations exist while still treating the skill as dangerous.
///
/// Author: Nullius
/// Version: 0.3.0 (Phase 2 -- Chain-of-Trust + Quarantine)
/// Network: Aztec devnet v4.0.0-devnet.2-patch.0
#[aztec]
pub contract IsnadRegistry {
    use aztec::{
        macros::{
            functions::{authorize_once, external, initializer, only_self, view},
            storage::storage,
        },
        messages::message_delivery::MessageDelivery,
        note::{
            note_getter_options::NoteGetterOptions,
            note_interface::NoteProperties,
            note_viewer_options::NoteViewerOptions,
        },
        protocol::{
            address::AztecAddress,
            hash::poseidon2_hash,
            traits::ToField,
        },
        state_vars::{Map, Owned, PrivateSet, PublicMutable, SingleUseClaim},
        utils::comparison::Comparator,
    };

    use crate::attestation_note::AttestationNote;
    use crate::auth_cert_note::AuthCertNote;
    use crate::credential_note::CredentialNote;
    use crate::utils::compute_effective_quality;

    // Maximum number of credentials returned in a single view_notes scan.
    global MAX_CREDENTIAL_NOTES: u32 = 10;

    // Maximum vouching chain depth -- prevents u8 overflow when computing depth+1.
    global MAX_CHAIN_DEPTH: u8 = 100;

    // --- STORAGE ---

    #[storage]
    struct Storage<Context> {
        /// Public: the contract admin -- the only address that can add root attestors.
        admin: PublicMutable<AztecAddress, Context>,

        /// Private: authorization certificates for each Isnad chain member.
        /// An address proves membership by holding an AuthCertNote in this set.
        /// Certificates are non-nullifiable: get_notes reads them without consuming them.
        auth_certs: Map<AztecAddress, Owned<PrivateSet<AuthCertNote, Context>, Context>, Context>,

        /// Public: whether a given address is an authorized attestor. Default = false.
        is_authorized: Map<AztecAddress, PublicMutable<bool, Context>, Context>,

        /// Public: vouching chain depth per authorized attestor (0 = root).
        attestor_depth: Map<AztecAddress, PublicMutable<u8, Context>, Context>,

        /// Public: aggregate weighted quality score per skill hash.
        trust_scores: Map<Field, PublicMutable<u64, Context>, Context>,

        /// Public: number of unique authorized auditors who have attested a given skill.
        attestation_counts: Map<Field, PublicMutable<u64, Context>, Context>,

        /// Public: emergency quarantine flags per skill hash.
        /// A quarantined skill returns get_trust_score() = 0 regardless of accumulated attestations.
        /// Writable only by admin. The underlying trust score is preserved for restoration.
        quarantine_flags: Map<Field, PublicMutable<bool, Context>, Context>,

        /// Private: per-auditor attestation notes.
        attestations: Map<AztecAddress, Owned<PrivateSet<AttestationNote, Context>, Context>, Context>,

        /// Anti-double-attestation: each (auditor, skill_hash) pair can claim exactly once.
        attest_claims: Map<Field, Owned<SingleUseClaim<Context>, Context>, Context>,

        /// Private: per-agent credential vault.
        credentials: Map<AztecAddress, Owned<PrivateSet<CredentialNote, Context>, Context>, Context>,
    }

    // --- CONSTRUCTOR ---

    /// Deploy the IsnadRegistry with an admin address.
    ///
    /// The admin is the only account that can add root attestors (depth=0) to the chain.
    /// Root attestors can then vouch new attestors at increasing depths.
    ///
    /// @param admin  The address that can add root attestors.
    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }

    // --- CHAIN-OF-TRUST MANAGEMENT ---

    /// Add a root attestor to the Isnad chain (admin only).
    ///
    /// Creates a private AuthCertNote (depth=0) for the new_attestor's PXE.
    /// The admin check is enforced in the public phase -- if the caller is not the admin,
    /// the public phase reverts, and the entire transaction (including the cert creation)
    /// is atomically discarded.
    ///
    /// Root attestors' attestations carry maximum weight (quality * 4).
    ///
    /// @param new_attestor  Address to authorize as root attestor.
    ///
    /// Reverts if: caller is not admin (detected in public phase), or new_attestor is
    ///             already authorized in the public registry.
    #[external("private")]
    fn add_root_attestor(new_attestor: AztecAddress) {
        let caller = self.context.maybe_msg_sender().unwrap();

        // Create the authorization certificate for new_attestor.
        // This note is delivered encrypted to new_attestor's PXE.
        let cert = AuthCertNote { depth: 0, owner: new_attestor };
        self.storage.auth_certs.at(new_attestor).at(new_attestor).insert(cert).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );

        // Enqueue public phase to verify admin and update the visible chain registry.
        // If caller != admin, this reverts the entire transaction (cert is discarded).
        self.enqueue_self._verify_and_register_root(caller, new_attestor);
    }

    /// Internal: verify admin and register a root attestor in the public chain registry.
    /// Called exclusively by add_root_attestor() via enqueue_self.
    /// If caller is not admin or new_attestor is already authorized, the ENTIRE tx reverts.
    #[external("public")]
    #[only_self]
    fn _verify_and_register_root(caller: AztecAddress, new_attestor: AztecAddress) {
        let admin = self.storage.admin.read();
        assert(caller == admin, "only the admin can add root attestors");

        let already_auth = self.storage.is_authorized.at(new_attestor).read();
        assert(!already_auth, "address is already an authorized attestor");

        self.storage.is_authorized.at(new_attestor).write(true);
        self.storage.attestor_depth.at(new_attestor).write(0);
    }

    /// Vouch a new attestor into the Isnad chain (authorized attestors only).
    ///
    /// The voucher proves their authority by presenting their AuthCertNote in the ZK circuit.
    /// The new attestor receives a cert at depth = voucher_depth + 1.
    ///
    /// The vouching chain is PUBLICLY VISIBLE via is_authorized and get_attestor_depth().
    /// This is the Isnad: an unbroken, traceable chain of authority.
    ///
    /// @param new_attestor  Address to bring into the Isnad chain.
    ///
    /// Reverts if: caller has no AuthCertNote (not authorized), depth limit exceeded,
    ///             or new_attestor is already authorized.
    #[external("private")]
    fn vouch(new_attestor: AztecAddress) {
        let voucher = self.context.maybe_msg_sender().unwrap();

        // Prove authorization by reading the voucher's cert (does not nullify it).
        let certs = self.storage.auth_certs.at(voucher).at(voucher).get_notes(
            NoteGetterOptions::new().set_limit(1),
        );
        assert(certs.len() == 1, "caller does not have an authorization certificate");
        let voucher_depth = certs.get_unchecked(0).note.depth;

        assert(voucher_depth < MAX_CHAIN_DEPTH, "vouching chain depth limit reached");
        let new_depth = voucher_depth + 1;

        // Create the authorization certificate for new_attestor.
        let cert = AuthCertNote { depth: new_depth, owner: new_attestor };
        self.storage.auth_certs.at(new_attestor).at(new_attestor).insert(cert).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );

        // Enqueue public phase to update the visible chain registry.
        self.enqueue_self._register_vouched(new_attestor, new_depth);
    }

    /// Internal: register a vouched attestor in the public chain registry.
    /// Called exclusively by vouch() via enqueue_self.
    #[external("public")]
    #[only_self]
    fn _register_vouched(new_attestor: AztecAddress, depth: u8) {
        let already_auth = self.storage.is_authorized.at(new_attestor).read();
        assert(!already_auth, "address is already an authorized attestor");

        self.storage.is_authorized.at(new_attestor).write(true);
        self.storage.attestor_depth.at(new_attestor).write(depth);
    }

    // --- CHAIN-OF-TRUST VIEW FUNCTIONS ---

    /// Check whether an address is an authorized attestor in the Isnad chain.
    #[external("public")]
    #[view]
    fn is_authorized_attestor(addr: AztecAddress) -> bool {
        self.storage.is_authorized.at(addr).read()
    }

    /// Get the vouching chain depth for an authorized attestor.
    /// Returns 0 for both root attestors AND unauthorized addresses.
    /// Use is_authorized_attestor() to distinguish between the two.
    #[external("public")]
    #[view]
    fn get_attestor_depth(addr: AztecAddress) -> u8 {
        self.storage.attestor_depth.at(addr).read()
    }

    // --- ATTESTATION FUNCTIONS ---

    /// Submit an anonymous attestation for a skill (authorized attestors only).
    ///
    /// Authorization is proven by presenting an AuthCertNote in the ZK circuit.
    /// The cert's depth determines the weighted contribution to the trust score:
    ///   depth=0 (root):  effective_quality = quality * 4
    ///   depth=1:         effective_quality = quality * 3
    ///   depth=2:         effective_quality = quality * 2
    ///   depth=3+:        effective_quality = quality * 1
    ///
    /// The auditor's identity and claim_type never appear in public state.
    ///
    /// @param skill_hash  SHA256 of the skill file content, packed as a Field
    /// @param quality     Auditor's quality score: 0-100
    /// @param claim_type  0=code_review, 1=behavioral, 2=sandboxed_execution
    ///
    /// Reverts if: caller has no AuthCertNote, quality > 100, claim_type > 2,
    ///             or this auditor has already attested this skill.
    #[external("private")]
    fn attest(skill_hash: Field, quality: u8, claim_type: u8) {
        let auditor = self.context.maybe_msg_sender().unwrap();

        // Prove authorization by reading the auditor's cert (does not nullify it).
        let certs = self.storage.auth_certs.at(auditor).at(auditor).get_notes(
            NoteGetterOptions::new().set_limit(1),
        );
        assert(certs.len() == 1, "caller is not an authorized attestor -- must be in the Isnad chain");
        let depth = certs.get_unchecked(0).note.depth;

        // Validate inputs.
        assert(quality <= 100, "quality must be in range 0-100");
        assert(claim_type <= 2, "claim_type must be 0 (code_review), 1 (behavioral), or 2 (sandboxed_execution)");

        // Compute weighted effective quality contribution based on chain depth.
        let effective_quality = compute_effective_quality(quality, depth);

        // Prevent double-attestation per (auditor, skill) pair.
        let claim_key = poseidon2_hash([auditor.to_field(), skill_hash]);
        self.storage.attest_claims.at(claim_key).at(auditor).claim();

        // Record the attestation privately.
        let attestation = AttestationNote { skill_hash, quality, claim_type, depth_at_attestation: depth, owner: auditor };
        self.storage.attestations.at(auditor).at(auditor).insert(attestation).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );

        // Enqueue the public score update with the weighted effective quality.
        self.enqueue_self._increment_score(skill_hash, effective_quality);
    }

    /// Revoke a prior attestation by nullifying the AttestationNote.
    ///
    /// Decrements the trust score by the exact weighted effective quality that was added.
    /// After revoking you cannot re-attest the same skill -- SingleUseClaim is permanent.
    ///
    /// @param skill_hash  SHA256 of the skill file content
    #[external("private")]
    fn revoke_attestation(skill_hash: Field) {
        let auditor = self.context.maybe_msg_sender().unwrap();

        let notes = self.storage.attestations.at(auditor).at(auditor).pop_notes(
            NoteGetterOptions::new()
                .select(AttestationNote::properties().skill_hash, Comparator.EQ, skill_hash)
                .set_limit(1),
        );
        assert(notes.len() == 1, "No attestation found for this skill");

        let note = notes.get_unchecked(0);
        let effective_quality = compute_effective_quality(note.quality, note.depth_at_attestation);
        self.enqueue_self._decrement_score(skill_hash, effective_quality);
    }

    /// Internal: increment the trust score for a skill.
    /// Called exclusively by attest() via enqueue_self.
    #[external("public")]
    #[only_self]
    fn _increment_score(skill_hash: Field, effective_quality: u64) {
        let current_score = self.storage.trust_scores.at(skill_hash).read();
        self.storage.trust_scores.at(skill_hash).write(current_score + effective_quality);

        let current_count = self.storage.attestation_counts.at(skill_hash).read();
        self.storage.attestation_counts.at(skill_hash).write(current_count + 1);
    }

    /// Internal: decrement the trust score for a skill upon revocation.
    #[external("public")]
    #[only_self]
    fn _decrement_score(skill_hash: Field, effective_quality: u64) {
        let current_score = self.storage.trust_scores.at(skill_hash).read();
        if current_score >= effective_quality {
            self.storage.trust_scores.at(skill_hash).write(current_score - effective_quality);
        }
        let current_count = self.storage.attestation_counts.at(skill_hash).read();
        if current_count > 0 {
            self.storage.attestation_counts.at(skill_hash).write(current_count - 1);
        }
    }

    /// Read the aggregate weighted trust score for a skill. No auth needed.
    ///
    /// Returns 0 for quarantined skills regardless of accumulated attestations.
    /// To distinguish quarantined (score forcibly zero) from unattested (score naturally zero),
    /// call is_quarantined() separately.
    #[external("public")]
    #[view]
    fn get_trust_score(skill_hash: Field) -> u64 {
        if self.storage.quarantine_flags.at(skill_hash).read() {
            0
        } else {
            self.storage.trust_scores.at(skill_hash).read()
        }
    }

    /// Read the number of unique authorized auditors who have attested a skill.
    /// NOTE: this count is NOT overridden by quarantine -- it reflects true attestation history.
    #[external("public")]
    #[view]
    fn get_attestation_count(skill_hash: Field) -> u64 {
        self.storage.attestation_counts.at(skill_hash).read()
    }

    // --- QUARANTINE FUNCTIONS ---

    /// Quarantine a skill (admin only -- emergency kill switch).
    ///
    /// A quarantined skill returns get_trust_score() = 0 regardless of accumulated
    /// attestations. Use when a skill is KNOWN malicious and waiting for individual
    /// auditors to revoke would leave other agents at risk.
    ///
    /// The underlying trust score is preserved -- unquarantine() restores it fully.
    ///
    /// @param skill_hash  SHA256 of the skill file content
    ///
    /// Reverts if: caller is not admin.
    #[external("private")]
    fn quarantine(skill_hash: Field) {
        let caller = self.context.maybe_msg_sender().unwrap();
        self.enqueue_self._set_quarantine(caller, skill_hash, true);
    }

    /// Remove quarantine from a skill (admin only).
    ///
    /// After unquarantine, get_trust_score() returns the actual accumulated score again.
    ///
    /// @param skill_hash  SHA256 of the skill file content
    ///
    /// Reverts if: caller is not admin.
    #[external("private")]
    fn unquarantine(skill_hash: Field) {
        let caller = self.context.maybe_msg_sender().unwrap();
        self.enqueue_self._set_quarantine(caller, skill_hash, false);
    }

    /// Internal: set or clear the quarantine flag for a skill.
    /// Verifies admin authorization and writes to quarantine_flags.
    /// Called exclusively by quarantine() and unquarantine() via enqueue_self.
    #[external("public")]
    #[only_self]
    fn _set_quarantine(caller: AztecAddress, skill_hash: Field, flagged: bool) {
        let admin = self.storage.admin.read();
        assert(caller == admin, "only the admin can quarantine or unquarantine skills");
        self.storage.quarantine_flags.at(skill_hash).write(flagged);
    }

    /// Check whether a skill is under quarantine. No auth needed.
    ///
    /// Use this alongside get_trust_score() to distinguish:
    ///   - score=0 AND is_quarantined=false: skill is unattested (unknown)
    ///   - score=0 AND is_quarantined=true:  skill is KNOWN MALICIOUS (hard reject)
    #[external("public")]
    #[view]
    fn is_quarantined(skill_hash: Field) -> bool {
        self.storage.quarantine_flags.at(skill_hash).read()
    }

    // --- CREDENTIAL VAULT FUNCTIONS ---

    /// Store a credential as a private note.
    #[external("private")]
    fn store_credential(key_id: Field, value: [Field; 4], label: Field) {
        let owner = self.context.maybe_msg_sender().unwrap();
        let cred = CredentialNote { key_id, value, label, owner };
        self.storage.credentials.at(owner).at(owner).insert(cred).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );
    }

    /// Read a credential from the vault. Off-circuit -- no ZK proof generated.
    #[external("utility")]
    unconstrained fn get_credential(owner: AztecAddress, key_id: Field) -> Option<[Field; 4]> {
        let options = NoteViewerOptions::new().set_limit(MAX_CREDENTIAL_NOTES);
        let notes = self.storage.credentials.at(owner).at(owner).view_notes(options);

        let mut result: Option<[Field; 4]> = Option::none();
        for i in 0..options.limit {
            if i < notes.len() {
                let note = notes.get_unchecked(i);
                if note.key_id == key_id {
                    result = Option::some(note.value);
                }
            }
        }
        result
    }

    /// Retrieve a credential on behalf of an owner (AuthWit delegation).
    #[authorize_once("owner", "authwit_nonce")]
    #[external("private")]
    fn get_credential_for_skill(owner: AztecAddress, key_id: Field, authwit_nonce: Field) -> [Field; 4] {
        let notes = self.storage.credentials.at(owner).at(owner).get_notes(
            NoteGetterOptions::new()
                .select(CredentialNote::properties().key_id, Comparator.EQ, key_id)
                .set_limit(1),
        );
        assert(notes.len() == 1, "Credential not found for key_id");
        notes.get_unchecked(0).note.value
    }

    /// Delete a credential by nullifying its note.
    #[external("private")]
    fn delete_credential(key_id: Field) {
        let owner = self.context.maybe_msg_sender().unwrap();
        let deleted = self.storage.credentials.at(owner).at(owner).pop_notes(
            NoteGetterOptions::new()
                .select(CredentialNote::properties().key_id, Comparator.EQ, key_id)
                .set_limit(1),
        );
        assert(deleted.len() == 1, "No credential found for key_id -- nothing to delete");
    }

    /// Rotate (replace) a credential atomically.
    #[external("private")]
    fn rotate_credential(key_id: Field, new_value: [Field; 4], label: Field) {
        let owner = self.context.maybe_msg_sender().unwrap();

        let removed = self.storage.credentials.at(owner).at(owner).pop_notes(
            NoteGetterOptions::new()
                .select(CredentialNote::properties().key_id, Comparator.EQ, key_id)
                .set_limit(1),
        );
        assert(removed.len() == 1, "No credential found for key_id -- cannot rotate a non-existent credential");

        let new_cred = CredentialNote { key_id, value: new_value, label, owner };
        self.storage.credentials.at(owner).at(owner).insert(new_cred).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );
    }

}
