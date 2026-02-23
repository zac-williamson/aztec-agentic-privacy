use aztec::macros::notes::note;
use aztec::protocol::{address::AztecAddress, traits::Packable};

/// CredentialNote stores a single secret credential (API key, token, etc.)
/// privately in the owning agent's PXE.
///
/// Security model:
/// - The PXE encrypts the entire note with the owner's public key before
///   emitting it as an on-chain log. Nobody else can decrypt it.
/// - No application-level double-encryption is needed -- the PXE handles it.
/// - The value field holds up to 128 bytes of credential data (4 x 32-byte Fields).
///   For longer values, encode as multiple notes with the same key_id and a sequence index.
///
/// Access delegation:
/// - The owner can grant a specific skill address read-only access to a specific
///   credential via AuthWit (see IsnadRegistry.get_credential_for_skill).
/// - The AuthWit is scoped to (caller, function_selector, key_id, nonce) --
///   it cannot be reused and cannot access other credentials.
#[derive(Eq, Packable)]
#[note]
pub struct CredentialNote {
    /// Application-defined identifier. Recommended: poseidon2_hash of the key name bytes.
    /// e.g. poseidon2_hash(string_as_fields) so string keys map deterministically to Fields.
    pub key_id: Field,
    /// The credential value. Up to 128 bytes (4 x 32-byte Fields).
    /// Store as raw bytes packed into Fields. PXE encrypts this at rest.
    pub value: [Field; 4],
    /// Human-readable label, packed as a Field (up to 31 ASCII bytes via str->Field).
    /// Used only for display in UIs; not used for access control.
    pub label: Field,
    /// The owning agent -- REQUIRED for note ownership, encryption, and nullifier derivation.
    pub owner: AztecAddress,
}
