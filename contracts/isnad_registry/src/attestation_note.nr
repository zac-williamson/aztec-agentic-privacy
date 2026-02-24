use aztec::macros::notes::note;
use aztec::protocol::{address::AztecAddress, traits::Packable};

/// AttestationNote records a single auditor's attestation of a skill.
///
/// Stored privately in the attesting auditor's PXE -- only they can read it.
/// The owner field enables note ownership, encryption, and nullifier derivation.
/// The skill_hash, quality, claim_type, and depth_at_attestation fields are never
/// revealed publicly; only the resulting trust score increment (via the enqueued
/// public call) is visible.
///
/// claim_type encoding:
///   0 = code_review       -- static analysis of skill source code
///   1 = behavioral        -- runtime behavior monitoring (syscall/tool-call auditing)
///   2 = sandboxed_execution -- isolated sandbox execution with output verification
///
/// depth_at_attestation: the vouching chain depth of the auditor at the time they
/// attested. Stored so that revoke_attestation() can decrement the exact effective
/// quality that was originally added (effective_quality = quality * weight(depth)).
#[derive(Eq, Packable)]
#[note]
pub struct AttestationNote {
    /// SHA256 of the skill file content bytes, packed as a Field
    pub skill_hash: Field,
    /// Auditor's quality score for this skill: 0-100
    pub quality: u8,
    /// Attestation methodology: 0=code_review, 1=behavioral, 2=sandboxed_execution
    pub claim_type: u8,
    /// Chain depth of the auditor at attestation time (0=root, 1=vouched by root, etc.)
    /// Stored so revocation can accurately decrement the weighted effective quality.
    pub depth_at_attestation: u8,
    /// The attesting agent -- REQUIRED for note ownership and nullifier derivation
    pub owner: AztecAddress,
}
