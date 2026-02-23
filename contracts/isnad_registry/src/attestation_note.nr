use aztec::macros::notes::note;
use aztec::protocol::{address::AztecAddress, traits::Packable};

/// AttestationNote records a single auditor's attestation of a skill.
///
/// Stored privately in the attesting auditor's PXE -- only they can read it.
/// The owner field enables note ownership, encryption, and nullifier derivation.
/// The skill_hash and quality fields are never revealed publicly; only the
/// resulting trust score increment (via the enqueued public call) is visible.
#[derive(Eq, Packable)]
#[note]
pub struct AttestationNote {
    /// SHA256 of the skill file content bytes, packed as a Field
    pub skill_hash: Field,
    /// Auditor's quality score for this skill: 0-100
    pub quality: u8,
    /// The attesting agent -- REQUIRED for note ownership and nullifier derivation
    pub owner: AztecAddress,
}
