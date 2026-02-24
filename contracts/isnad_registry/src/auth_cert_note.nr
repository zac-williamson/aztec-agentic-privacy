use aztec::macros::notes::note;
use aztec::protocol::{address::AztecAddress, traits::Packable};

/// AuthCertNote -- an authorization certificate for an attestor in the Isnad chain.
///
/// Stored privately in the authorized attestor's PXE.
/// An address proves it is an authorized attestor by HOLDING this note in its private set.
/// The note is NOT nullified when presented (get_notes, not pop_notes) -- it persists
/// across multiple attestations.
///
/// depth=0: root attestor (created by admin via add_root_attestor)
/// depth=1: vouched by a root attestor
/// depth=N: vouched by an attestor at depth N-1
///
/// The certificate is created by the admin (via add_root_attestor) or by an existing
/// authorized attestor (via vouch). It is cryptographically committed to the note hash tree,
/// so its contents (especially depth) cannot be forged.
#[derive(Eq, Packable)]
#[note]
pub struct AuthCertNote {
    /// Chain depth: 0 = root attestor, 1 = vouched by root, etc.
    /// Determines the trust score weight multiplier for attestations:
    ///   depth=0: weight=4, depth=1: weight=3, depth=2: weight=2, depth=3+: weight=1
    pub depth: u8,
    /// The authorized attestor -- REQUIRED for note ownership and nullifier derivation
    pub owner: AztecAddress,
}
