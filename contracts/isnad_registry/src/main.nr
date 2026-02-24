mod attestation_note;
mod credential_note;

use aztec::macros::aztec;

/// IsnadRegistry -- ZK Skill Attestation and Credential Registry for AI agents
///
/// The Isnad Chain: provenance authentication for skills, powered by zero-knowledge proofs.
/// Auditors submit anonymous attestations that increment public trust scores.
/// Agents store API keys and secrets as private notes, delegatable via AuthWit.
///
/// Private state (encrypted, in Note Hash Tree -- visible only to owners):
///   - attestations: each auditor's personal record of what they have attested
///   - credentials: each agent's vault of API keys and secrets
///
/// Public state (visible to all, on-chain):
///   - trust_scores: aggregate quality score per skill hash
///   - attestation_counts: how many unique auditors have attested a skill
///
/// Author: Nullius
/// Version: 0.1.0 (Phase 2 MVP)
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
    use crate::credential_note::CredentialNote;

    // Maximum number of credentials returned in a single view_notes scan.
    // Must be <= MAX_NOTES_PER_PAGE (defined by aztec-nr, currently 10).
    // Increase requires matching NoteViewerOptions.set_limit call.
    global MAX_CREDENTIAL_NOTES: u32 = 10;

    // --- STORAGE ---

    #[storage]
    struct Storage<Context> {
        /// Public: aggregate quality score per skill (skill_hash -> cumulative quality)
        trust_scores: Map<Field, PublicMutable<u64, Context>, Context>,

        /// Public: number of unique auditors who have attested a given skill
        attestation_counts: Map<Field, PublicMutable<u64, Context>, Context>,

        /// Private: per-auditor attestation notes.
        /// Owned<PrivateSet<...>, Context> wraps the PrivateSet per-owner.
        /// Access pattern: .at(auditor_address)  -> Owned -> .at(auditor_address) -> PrivateSet
        attestations: Map<AztecAddress, Owned<PrivateSet<AttestationNote, Context>, Context>, Context>,

        /// Anti-double-attestation: each (auditor, skill_hash) pair can claim exactly once.
        /// Key = poseidon2_hash([auditor.to_field(), skill_hash]) -- unique per (auditor, skill).
        /// Claiming emits a nullifier; a second claim with the same key reverts.
        attest_claims: Map<Field, Owned<SingleUseClaim<Context>, Context>, Context>,

        /// Private: per-agent credential vault.
        /// Access pattern: .at(owner_address) -> Owned -> .at(owner_address) -> PrivateSet
        credentials: Map<AztecAddress, Owned<PrivateSet<CredentialNote, Context>, Context>, Context>,
    }

    // --- CONSTRUCTOR ---

    /// Deploy the IsnadRegistry. No initial state needed for v1.
    #[external("public")]
    #[initializer]
    fn constructor() {}

    // --- ATTESTATION FUNCTIONS ---

    /// Submit an anonymous attestation for a skill.
    ///
    /// Creates a private AttestationNote in the auditor's PXE -- their personal record.
    /// Enqueues a public call to increment the skill's trust score.
    /// The auditor's identity never appears in public state.
    ///
    /// @param skill_hash  SHA256 of the skill file content, packed as a Field
    /// @param quality     Auditor's quality score for the skill: 0-100
    /// @param claim_type  Attestation methodology:
    ///                      0 = code_review       (static analysis of source)
    ///                      1 = behavioral        (runtime behavior monitoring)
    ///                      2 = sandboxed_execution (isolated sandbox with output verification)
    ///
    /// Reverts if this auditor has already attested this skill (SingleUseClaim).
    #[external("private")]
    fn attest(skill_hash: Field, quality: u8, claim_type: u8) {
        let auditor = self.context.maybe_msg_sender().unwrap();

        // Prevent double-attestation: derive a unique claim key per (auditor, skill).
        // poseidon2_hash is Aztec's standard hash for Field operations.
        let claim_key = poseidon2_hash([auditor.to_field(), skill_hash]);
        // Map.at(claim_key) -> Owned<SingleUseClaim> -> .at(auditor) -> SingleUseClaim -> .claim()
        self.storage.attest_claims.at(claim_key).at(auditor).claim();

        // Record the attestation privately -- only the auditor can read this.
        // Map.at(auditor) -> Owned<PrivateSet> -> .at(auditor) -> PrivateSet -> .insert()
        let attestation = AttestationNote { skill_hash, quality, claim_type, owner: auditor };
        self.storage.attestations.at(auditor).at(auditor).insert(attestation).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );

        // Enqueue the public score update -- executes after private phase completes.
        self.enqueue_self._increment_score(skill_hash, quality as u64);
    }

    /// Revoke a prior attestation by nullifying the AttestationNote.
    ///
    /// Decrements the skill's public trust score by the attested quality amount.
    /// Use when you discover that a skill you previously attested is unsafe.
    ///
    /// Note: the SingleUseClaim nullifier for (auditor, skill_hash) was emitted when
    /// you attested and is NOT re-used here. After revoking, you cannot re-attest
    /// the same skill (the claim is already consumed).
    ///
    /// @param skill_hash  SHA256 of the skill file content
    #[external("private")]
    fn revoke_attestation(skill_hash: Field) {
        let auditor = self.context.maybe_msg_sender().unwrap();

        // Pop (nullify) the attestation note for this skill.
        // This atomically reads + nullifies in one operation.
        let notes = self.storage.attestations.at(auditor).at(auditor).pop_notes(
            NoteGetterOptions::new()
                .select(AttestationNote::properties().skill_hash, Comparator.EQ, skill_hash)
                .set_limit(1),
        );
        assert(notes.len() == 1, "No attestation found for this skill");

        // Recover the quality score to decrement the public trust score accurately.
        let quality = notes.get_unchecked(0).quality;
        self.enqueue_self._decrement_score(skill_hash, quality as u64);
    }

    /// Internal: increment the trust score for a skill.
    /// Called exclusively by attest() via enqueue_self -- cannot be called externally.
    #[external("public")]
    #[only_self]
    fn _increment_score(skill_hash: Field, quality: u64) {
        let current_score = self.storage.trust_scores.at(skill_hash).read();
        self.storage.trust_scores.at(skill_hash).write(current_score + quality);

        let current_count = self.storage.attestation_counts.at(skill_hash).read();
        self.storage.attestation_counts.at(skill_hash).write(current_count + 1);
    }

    /// Internal: decrement the trust score for a skill upon revocation.
    /// Called exclusively by revoke_attestation() via enqueue_self.
    #[external("public")]
    #[only_self]
    fn _decrement_score(skill_hash: Field, quality: u64) {
        let current_score = self.storage.trust_scores.at(skill_hash).read();
        if current_score >= quality {
            self.storage.trust_scores.at(skill_hash).write(current_score - quality);
        }
        let current_count = self.storage.attestation_counts.at(skill_hash).read();
        if current_count > 0 {
            self.storage.attestation_counts.at(skill_hash).write(current_count - 1);
        }
    }

    /// Read the aggregate trust score for a skill. No authentication needed.
    /// Returns 0 if no attestations have been submitted for this skill.
    #[external("public")]
    #[view]
    fn get_trust_score(skill_hash: Field) -> u64 {
        self.storage.trust_scores.at(skill_hash).read()
    }

    /// Read the number of unique auditors who have attested a skill.
    /// No authentication needed. Returns 0 if unattested.
    #[external("public")]
    #[view]
    fn get_attestation_count(skill_hash: Field) -> u64 {
        self.storage.attestation_counts.at(skill_hash).read()
    }

    // --- CREDENTIAL VAULT FUNCTIONS ---

    /// Store a credential (API key, token, secret) as a private note.
    /// Only the owner can retrieve it; use AuthWit to delegate access to a skill.
    ///
    /// @param key_id  Identifier for this credential (e.g. poseidon2_hash of key name bytes)
    /// @param value   The credential value, up to 128 bytes packed as [Field; 4]
    /// @param label   Human-readable label (up to 31 ASCII bytes packed as Field)
    #[external("private")]
    fn store_credential(key_id: Field, value: [Field; 4], label: Field) {
        let owner = self.context.maybe_msg_sender().unwrap();
        let cred = CredentialNote { key_id, value, label, owner };
        // Map.at(owner) -> Owned<PrivateSet> -> .at(owner) -> PrivateSet -> .insert()
        self.storage.credentials.at(owner).at(owner).insert(cred).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );
    }

    /// Read a credential from the vault. Off-circuit -- runs in PXE, no ZK proof generated.
    /// Only the owner's PXE will be able to decrypt and return the result.
    ///
    /// Returns Option::none() if no credential with the given key_id is found.
    ///
    /// @param owner   The agent whose vault to read
    /// @param key_id  Identifier for the credential to retrieve
    #[external("utility")]
    unconstrained fn get_credential(owner: AztecAddress, key_id: Field) -> Option<[Field; 4]> {
        // view_notes uses NoteViewerOptions (not NoteGetterOptions) in utility context.
        // set_limit caps the scan to MAX_CREDENTIAL_NOTES for efficiency.
        let options = NoteViewerOptions::new().set_limit(MAX_CREDENTIAL_NOTES);
        // Map.at(owner) -> Owned<PrivateSet> -> .at(owner) -> PrivateSet -> .view_notes()
        let notes = self.storage.credentials.at(owner).at(owner).view_notes(options);

        let mut result: Option<[Field; 4]> = Option::none();
        // Loop bound must match options.limit (a compile-time constant).
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
    ///
    /// The owner can call this directly by passing authwit_nonce = 0.
    /// A delegated skill calls this by presenting an AuthWit the owner created for:
    ///   (skill_address, get_credential_for_skill, owner, key_id, authwit_nonce)
    /// The AuthWit is single-use -- authwit_nonce must be unique per delegation grant.
    ///
    /// @param owner         The agent whose vault to read
    /// @param key_id        Identifier for the credential (e.g. poseidon2_hash of name)
    /// @param authwit_nonce Replay-prevention nonce. Pass 0 when calling as owner.
    ///
    /// Reverts if the credential is not found or authorization check fails.
    #[authorize_once("owner", "authwit_nonce")]
    #[external("private")]
    fn get_credential_for_skill(owner: AztecAddress, key_id: Field, authwit_nonce: Field) -> [Field; 4] {
        // get_notes reads without nullifying -- credential persists after delegation read.
        // The AuthWit nonce nullifier (emitted by authorize_once) prevents replay.
        let notes = self.storage.credentials.at(owner).at(owner).get_notes(
            NoteGetterOptions::new()
                .select(CredentialNote::properties().key_id, Comparator.EQ, key_id)
                .set_limit(1),
        );
        assert(notes.len() == 1, "Credential not found for key_id");
        // get_notes returns ConfirmedNote<T> wrappers -- access .note to get the inner CredentialNote
        notes.get_unchecked(0).note.value
    }

    /// Delete a credential by nullifying its note.
    /// The credential becomes permanently inaccessible after this call.
    /// Use rotate_credential() for atomic delete + replace.
    ///
    /// @param key_id  Identifier for the credential to delete
    #[external("private")]
    fn delete_credential(key_id: Field) {
        let owner = self.context.maybe_msg_sender().unwrap();
        // pop_notes atomically reads + nullifies the matching note.
        let _ = self.storage.credentials.at(owner).at(owner).pop_notes(
            NoteGetterOptions::new()
                .select(CredentialNote::properties().key_id, Comparator.EQ, key_id)
                .set_limit(1),
        );
    }

    /// Rotate (replace) a credential atomically in a single transaction.
    ///
    /// Nullifies the old credential note and inserts a new one with the same key_id.
    /// Safer than calling delete_credential + store_credential separately because
    /// the vault is never in an empty state between transactions.
    ///
    /// @param key_id     Identifier for the credential to rotate
    /// @param new_value  The new credential value, up to 128 bytes as [Field; 4]
    /// @param label      Human-readable label for the new credential
    #[external("private")]
    fn rotate_credential(key_id: Field, new_value: [Field; 4], label: Field) {
        let owner = self.context.maybe_msg_sender().unwrap();

        // Nullify the old credential note (if present -- reverts if not found).
        let _ = self.storage.credentials.at(owner).at(owner).pop_notes(
            NoteGetterOptions::new()
                .select(CredentialNote::properties().key_id, Comparator.EQ, key_id)
                .set_limit(1),
        );

        // Insert the replacement credential note.
        let new_cred = CredentialNote { key_id, value: new_value, label, owner };
        self.storage.credentials.at(owner).at(owner).insert(new_cred).deliver(
            MessageDelivery.ONCHAIN_CONSTRAINED,
        );
    }
}
