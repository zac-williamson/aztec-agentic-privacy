/// IsnadRegistry Contract Tests
///
/// Tests for the chain-of-trust model (add_root_attestor, vouch, attest, revoke_attestation)
/// and the credential vault (store_credential, get_credential, delete_credential, rotate_credential)
/// using the Aztec v4 TestEnvironment.
///
/// === Chain-of-Trust Model ===
///
/// Only authorized attestors (root or vouched in) can call attest().
/// Trust scores are weighted by chain depth:
///   depth=0 (root): effective_quality = quality * 4
///   depth=1:        effective_quality = quality * 3
///   depth=2:        effective_quality = quality * 2
///   depth=3+:       effective_quality = quality * 1
///
/// === Running these tests =====================================================
///
///   REQUIRES TXE SERVER:
///     LD_PRELOAD=.../glibc_shim.so node .../txe/dest/bin/index.js &
///     nargo test --oracle-resolver http://localhost:8080
///
///   COMPILE-ONLY CHECK (no TXE needed):
///     nargo test --no-run
///
/// =============================================================================

use aztec::test::helpers::test_environment::TestEnvironment;
use aztec::protocol::address::AztecAddress;

use crate::IsnadRegistry;

/// Stable, well-known skill hashes for testing.
/// In production: SHA256(skill_file_content_bytes) truncated to 248 bits.
global SKILL_A: Field = 0x1234567890abcdef;
global SKILL_B: Field = 0x9876543210fedcba;
global SKILL_C: Field = 0xabcdef1234567890;

/// claim_type constants
global CLAIM_CODE_REVIEW: u8 = 0;
global CLAIM_BEHAVIORAL: u8 = 1;
global CLAIM_SANDBOXED: u8 = 2;

/// Mock credential key_ids (e.g. poseidon2_hash(b"openai-key"))
global KEY_OPENAI: Field = 0x0a0b0c0d0e0f1011;
global KEY_GITHUB: Field = 0x1a1b1c1d1e1f2021;

/// Mock credential values (4 Fields = 128 bytes capacity).
global CRED_VALUE_1: [Field; 4] = [0x01, 0x02, 0x03, 0x04];
global CRED_VALUE_2: [Field; 4] = [0x0a, 0x0b, 0x0c, 0x0d];
/// "OpenAI" as ASCII bytes packed into a Field
global CRED_LABEL: Field = 0x4f70656e4149;

/// Deploy IsnadRegistry and return (env, contract_address, admin).
/// The deployer is set as admin in the constructor.
unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let admin = env.create_light_account();
    let contract_addr = env.deploy("IsnadRegistry").with_public_initializer(
        admin,
        IsnadRegistry::interface().constructor(admin),
    );
    (env, contract_addr, admin)
}

/// Deploy and set up a single root auditor (depth=0).
/// Returns (env, contract_addr, admin, root_auditor).
unconstrained fn setup_with_root_auditor() -> (TestEnvironment, AztecAddress, AztecAddress, AztecAddress) {
    let (mut env, addr, admin) = setup();
    let auditor = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(auditor));
    (env, addr, admin, auditor)
}

// === CHAIN-OF-TRUST: AUTHORIZATION MANAGEMENT ================================

/// add_root_attestor() marks the address as authorized at depth=0.
#[test]
unconstrained fn test_add_root_attestor_authorizes() {
    let (mut env, addr, admin) = setup();
    let attestor = env.create_light_account();

    assert_eq(env.view_public(IsnadRegistry::at(addr).is_authorized_attestor(attestor)), false);

    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(attestor));

    assert_eq(env.view_public(IsnadRegistry::at(addr).is_authorized_attestor(attestor)), true);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestor_depth(attestor)), 0u8);
}

/// Non-admin cannot add root attestors -- must revert.
#[test(should_fail_with = "only the admin can add root attestors")]
unconstrained fn test_non_admin_cannot_add_root_attestor() {
    let (mut env, addr, _admin) = setup();
    let rando = env.create_light_account();
    let target = env.create_light_account();
    // rando is not the admin -- this must revert
    env.call_private(rando, IsnadRegistry::at(addr).add_root_attestor(target));
}

/// Adding the same address twice reverts.
#[test(should_fail_with = "address is already an authorized attestor")]
unconstrained fn test_double_add_root_attestor_reverts() {
    let (mut env, addr, admin) = setup();
    let attestor = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(attestor));
    // Second add must revert
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(attestor));
}

/// vouch() creates a depth-1 attestor when called by a root attestor.
#[test]
unconstrained fn test_vouch_creates_depth1_attestor() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let new_member = env.create_light_account();

    env.call_private(root, IsnadRegistry::at(addr).vouch(new_member));

    assert_eq(env.view_public(IsnadRegistry::at(addr).is_authorized_attestor(new_member)), true);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestor_depth(new_member)), 1u8);
}

/// vouch() chain: depth-1 attestor vouches a depth-2 attestor.
#[test]
unconstrained fn test_vouch_chain_depth2() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let depth1 = env.create_light_account();
    let depth2 = env.create_light_account();

    env.call_private(root, IsnadRegistry::at(addr).vouch(depth1));
    env.call_private(depth1, IsnadRegistry::at(addr).vouch(depth2));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestor_depth(depth1)), 1u8);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestor_depth(depth2)), 2u8);
}

/// Unauthorized address cannot vouch -- must revert.
#[test(should_fail_with = "caller does not have an authorization certificate")]
unconstrained fn test_non_attestor_cannot_vouch() {
    let (mut env, addr, _admin) = setup();
    let rando = env.create_light_account();
    let target = env.create_light_account();
    // rando is not authorized -- vouch must revert
    env.call_private(rando, IsnadRegistry::at(addr).vouch(target));
}

/// Vouching an already-authorized address reverts.
#[test(should_fail_with = "address is already an authorized attestor")]
unconstrained fn test_vouch_already_authorized_reverts() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let member = env.create_light_account();
    env.call_private(root, IsnadRegistry::at(addr).vouch(member));
    // Second vouch must revert
    env.call_private(root, IsnadRegistry::at(addr).vouch(member));
}

// === CHAIN-OF-TRUST: WEIGHTED ATTESTATION ====================================

/// Unauthorized attestor is rejected -- attest() reverts.
#[test(should_fail_with = "caller is not an authorized attestor -- must be in the Isnad chain")]
unconstrained fn test_unauthorized_attestor_reverts() {
    let (mut env, addr, _admin) = setup();
    let rando = env.create_light_account();
    // rando has not been authorized -- attest() must revert
    env.call_private(rando, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));
}

/// Root attestor (depth=0) contributes quality * 4 to the trust score.
#[test]
unconstrained fn test_root_attestor_weight_is_4x() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();

    env.call_private(root, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));

    // depth=0, weight=4: effective_quality = 100 * 4 = 400
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 400u64);
}

/// Depth-1 attestor contributes quality * 3 to the trust score.
#[test]
unconstrained fn test_depth1_attestor_weight_is_3x() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let depth1 = env.create_light_account();
    env.call_private(root, IsnadRegistry::at(addr).vouch(depth1));

    env.call_private(depth1, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));

    // depth=1, weight=3: effective_quality = 100 * 3 = 300
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 300u64);
}

/// Depth-2 attestor contributes quality * 2 to the trust score.
#[test]
unconstrained fn test_depth2_attestor_weight_is_2x() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let depth1 = env.create_light_account();
    let depth2 = env.create_light_account();
    env.call_private(root, IsnadRegistry::at(addr).vouch(depth1));
    env.call_private(depth1, IsnadRegistry::at(addr).vouch(depth2));

    env.call_private(depth2, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));

    // depth=2, weight=2: effective_quality = 100 * 2 = 200
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 200u64);
}

/// Depth-3+ attestor contributes quality * 1 (minimum weight).
#[test]
unconstrained fn test_depth3_attestor_weight_is_1x() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let depth1 = env.create_light_account();
    let depth2 = env.create_light_account();
    let depth3 = env.create_light_account();
    env.call_private(root, IsnadRegistry::at(addr).vouch(depth1));
    env.call_private(depth1, IsnadRegistry::at(addr).vouch(depth2));
    env.call_private(depth2, IsnadRegistry::at(addr).vouch(depth3));

    env.call_private(depth3, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));

    // depth=3, weight=1: effective_quality = 100 * 1 = 100
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 100u64);
}

// === TRUST SCORE QUERIES =====================================================

/// Unattested skill returns trust score = 0.
#[test]
unconstrained fn test_initial_trust_score_is_zero() {
    let (env, addr, _) = setup();
    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    assert_eq(score, 0u64);
}

/// Unattested skill returns attestation count = 0.
#[test]
unconstrained fn test_initial_attestation_count_is_zero() {
    let (env, addr, _) = setup();
    let count = env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A));
    assert_eq(count, 0u64);
}

/// Two different unattested skills each have independent scores of 0.
#[test]
unconstrained fn test_different_unattested_skills_independent() {
    let (env, addr, _) = setup();
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_B)), 0u64);
}

// === ATTESTATION: HAPPY PATH =================================================
// All tests use root attestors (depth=0, weight=4) unless testing depth weighting.

/// attest() with quality=85 (root auditor): trust score = 85 * 4 = 340.
#[test]
unconstrained fn test_attest_increments_trust_score() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));

    // depth=0, weight=4: 85 * 4 = 340
    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    assert_eq(score, 340u64);
}

/// attest() increments attestation count to 1.
#[test]
unconstrained fn test_attest_increments_attestation_count() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 70, CLAIM_BEHAVIORAL));

    let count = env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A));
    assert_eq(count, 1u64);
}

/// attest() with quality=0 (minimum): count increments but score stays at 0.
#[test]
unconstrained fn test_attest_with_minimum_quality() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 0, CLAIM_CODE_REVIEW));

    // 0 * 4 = 0
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// attest() with quality=100 (maximum, root): score = 100 * 4 = 400.
#[test]
unconstrained fn test_attest_with_maximum_quality() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));

    // depth=0, weight=4: 100 * 4 = 400
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 400u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// claim_type=1 (behavioral) is accepted.
#[test]
unconstrained fn test_attest_with_claim_type_behavioral() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 75, CLAIM_BEHAVIORAL));

    // depth=0, weight=4: 75 * 4 = 300
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 300u64);
}

/// claim_type=2 (sandboxed_execution) is accepted.
#[test]
unconstrained fn test_attest_with_claim_type_sandboxed() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 95, CLAIM_SANDBOXED));

    // depth=0, weight=4: 95 * 4 = 380
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 380u64);
}

/// Two distinct root auditors accumulate scores independently.
/// Final score = sum of both effective qualities.
#[test]
unconstrained fn test_two_auditors_accumulate_scores() {
    let (mut env, addr, admin) = setup();
    let auditor_1 = env.create_light_account();
    let auditor_2 = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(auditor_1));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(auditor_2));

    env.call_private(auditor_1, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor_2, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_BEHAVIORAL));

    // auditor_1: 80*4=320, auditor_2: 90*4=360, total=680
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 680u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 2u64);
}

/// Three root auditors with different claim_types accumulate correctly.
#[test]
unconstrained fn test_three_auditors_genesis_set() {
    let (mut env, addr, admin) = setup();
    let kobold = env.create_light_account();
    let hk47 = env.create_light_account();
    let syntrax = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(kobold));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(hk47));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(syntrax));

    env.call_private(kobold, IsnadRegistry::at(addr).attest(SKILL_A, 82, CLAIM_CODE_REVIEW));
    env.call_private(hk47, IsnadRegistry::at(addr).attest(SKILL_A, 78, CLAIM_BEHAVIORAL));
    env.call_private(syntrax, IsnadRegistry::at(addr).attest(SKILL_A, 95, CLAIM_SANDBOXED));

    // kobold: 82*4=328, hk47: 78*4=312, syntrax: 95*4=380, total=1020
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 1020u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 3u64);
}

/// Trust scores of two different skills are independent.
#[test]
unconstrained fn test_different_skills_have_independent_scores() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 75, CLAIM_CODE_REVIEW));

    // SKILL_A: 75*4=300, SKILL_B: 0
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 300u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_B)), 0u64);
}

/// One root auditor can attest multiple different skills independently.
#[test]
unconstrained fn test_one_auditor_attests_multiple_skills() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_B, 90, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_C, 85, CLAIM_CODE_REVIEW));

    // 80*4=320, 90*4=360, 85*4=340
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 320u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 360u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_C)), 340u64);
}

// === ATTESTATION: VALIDATION =================================================

/// quality > 100 is rejected.
#[test(should_fail_with = "quality must be in range 0-100")]
unconstrained fn test_attest_quality_above_100_reverts() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 101, CLAIM_CODE_REVIEW));
}

/// claim_type=3 (invalid) is rejected.
#[test(should_fail_with = "claim_type must be 0 (code_review), 1 (behavioral), or 2 (sandboxed_execution)")]
unconstrained fn test_attest_invalid_claim_type_reverts() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, 3));
}

/// Same auditor cannot attest the same skill twice (SingleUseClaim).
#[test(should_fail_with = "duplicate siloed nullifier")]
unconstrained fn test_double_attestation_reverts() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    // Second attest: SingleUseClaim nullifier is spent -- must revert
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_CODE_REVIEW));
}

/// Double-attest on SKILL_A does not block attest on SKILL_B by same auditor.
#[test]
unconstrained fn test_double_attest_on_a_does_not_block_attest_on_b() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_B, 85, CLAIM_CODE_REVIEW));

    // 80*4=320, 85*4=340
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 320u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 340u64);
}

// === REVOCATION ==============================================================

/// revoke_attestation() decrements trust score by exact effective quality.
#[test]
unconstrained fn test_revoke_decrements_trust_score() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));
    // 85*4=340
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 340u64);

    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
}

/// revoke_attestation() decrements attestation count to 0.
#[test]
unconstrained fn test_revoke_decrements_attestation_count() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 0u64);
}

/// Partial revocation: Alice (root) revokes, Bob's (root) score and count remain.
#[test]
unconstrained fn test_partial_revoke_leaves_other_auditor_score() {
    let (mut env, addr, admin) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(alice));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(bob));

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(bob, IsnadRegistry::at(addr).attest(SKILL_A, 70, CLAIM_BEHAVIORAL));
    // alice: 80*4=320, bob: 70*4=280, total=600
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 600u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 2u64);

    env.call_private(alice, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    // Only Bob's score (70*4=280) remains
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 280u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// Trust score does not go below 0 (safe subtraction guard in _decrement_score).
#[test]
unconstrained fn test_revoke_score_floor_at_zero() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 50, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
}

/// Revoking without a prior attestation reverts.
#[test(should_fail_with = "No attestation found for this skill")]
unconstrained fn test_revoke_without_attestation_reverts() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
}

/// Cannot revoke another auditor's attestation.
#[test(should_fail_with = "No attestation found for this skill")]
unconstrained fn test_revoke_different_auditor_attestation_reverts() {
    let (mut env, addr, admin) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(alice));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(bob));

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    // Bob tries to revoke Alice's attestation -- no note in Bob's PrivateSet
    env.call_private(bob, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
}

/// After revoking, the auditor cannot re-attest the same skill.
/// The SingleUseClaim nullifier is permanent.
#[test(should_fail_with = "duplicate siloed nullifier")]
unconstrained fn test_revoke_then_reattest_blocked_by_single_use_claim() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
    // Attempting to re-attest: SingleUseClaim nullifier is still spent
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
}

/// A second auditor CAN attest a skill that was previously revoked by the first auditor.
#[test]
unconstrained fn test_second_auditor_can_attest_after_first_revokes() {
    let (mut env, addr, admin) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(alice));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(bob));

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(alice, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);

    // Bob (fresh identity) can still attest
    env.call_private(bob, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_BEHAVIORAL));
    // 90*4=360
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 360u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// Revoking one skill does not affect the auditor's attestation of a different skill.
#[test]
unconstrained fn test_revoke_skill_a_does_not_affect_skill_b() {
    let (mut env, addr, _admin, auditor) = setup_with_root_auditor();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_B, 90, CLAIM_CODE_REVIEW));

    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    // 90*4=360
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 360u64);
}

/// Revocation uses the depth stored AT TIME OF ATTESTATION, not the current depth.
/// This ensures accurate score accounting even if an attestor is later re-registered.
#[test]
unconstrained fn test_revoke_uses_stored_depth() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let depth1 = env.create_light_account();
    env.call_private(root, IsnadRegistry::at(addr).vouch(depth1));

    // depth-1 attests at weight=3
    env.call_private(depth1, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));
    // 100*3=300
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 300u64);

    // Revocation should remove exactly 300 (the original effective quality)
    env.call_private(depth1, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
}

// === CREDENTIAL VAULT ========================================================

/// store_credential() stores a note, get_credential() returns the value.
#[test]
unconstrained fn test_store_and_get_credential() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );

    let result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    assert(result.is_some());
    let value = result.unwrap();
    assert_eq(value[0], CRED_VALUE_1[0]);
    assert_eq(value[1], CRED_VALUE_1[1]);
    assert_eq(value[2], CRED_VALUE_1[2]);
    assert_eq(value[3], CRED_VALUE_1[3]);
}

/// get_credential() returns Option::none() for an unknown key_id.
#[test]
unconstrained fn test_get_credential_unknown_key_returns_none() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    let result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    assert(result.is_none());
}

/// Two agents store credentials under the same key_id -- vaults are fully isolated.
#[test]
unconstrained fn test_credential_vaults_isolated_per_owner() {
    let (mut env, addr, _) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    env.call_private(
        alice,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    env.call_private(
        bob,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_2, CRED_LABEL),
    );

    let alice_result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(alice, KEY_OPENAI));
    assert(alice_result.is_some());
    assert_eq(alice_result.unwrap()[0], CRED_VALUE_1[0]);

    let bob_result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(bob, KEY_OPENAI));
    assert(bob_result.is_some());
    assert_eq(bob_result.unwrap()[0], CRED_VALUE_2[0]);

    let alice_github = env.simulate_utility(IsnadRegistry::at(addr).get_credential(alice, KEY_GITHUB));
    assert(alice_github.is_none());
}

/// An agent can store multiple credentials under different key_ids.
#[test]
unconstrained fn test_multiple_credentials_per_owner() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_GITHUB, CRED_VALUE_2, CRED_LABEL),
    );

    let openai = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    let github = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_GITHUB));

    assert(openai.is_some());
    assert(github.is_some());
    assert_eq(openai.unwrap()[0], CRED_VALUE_1[0]);
    assert_eq(github.unwrap()[0], CRED_VALUE_2[0]);
}

/// delete_credential() nullifies the note -- credential returns none afterwards.
#[test]
unconstrained fn test_delete_credential_removes_note() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_some());

    env.call_private(agent, IsnadRegistry::at(addr).delete_credential(KEY_OPENAI));

    let result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    assert(result.is_none());
}

/// Deleting credential A does not affect credential B.
#[test]
unconstrained fn test_delete_does_not_affect_other_credential() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_GITHUB, CRED_VALUE_2, CRED_LABEL),
    );

    env.call_private(agent, IsnadRegistry::at(addr).delete_credential(KEY_OPENAI));

    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_none());
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_GITHUB)).is_some());
}

/// delete_credential() on a non-existent key_id reverts.
#[test(should_fail_with = "No credential found for key_id -- nothing to delete")]
unconstrained fn test_delete_nonexistent_credential_reverts() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();
    env.call_private(agent, IsnadRegistry::at(addr).delete_credential(KEY_OPENAI));
}

/// rotate_credential() atomically replaces the credential value.
#[test]
unconstrained fn test_rotate_credential_updates_value() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );

    env.call_private(
        agent,
        IsnadRegistry::at(addr).rotate_credential(KEY_OPENAI, CRED_VALUE_2, CRED_LABEL),
    );

    let result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    assert(result.is_some());
    assert_eq(result.unwrap()[0], CRED_VALUE_2[0]);
}

/// Multiple sequential rotations keep exactly one active credential.
#[test]
unconstrained fn test_rotate_credential_multiple_times() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    env.call_private(
        agent,
        IsnadRegistry::at(addr).rotate_credential(KEY_OPENAI, CRED_VALUE_2, CRED_LABEL),
    );

    let v3: [Field; 4] = [0x0d, 0x0c, 0x0b, 0x0a];
    env.call_private(
        agent,
        IsnadRegistry::at(addr).rotate_credential(KEY_OPENAI, v3, CRED_LABEL),
    );

    let result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    assert(result.is_some());
    assert_eq(result.unwrap()[0], v3[0]);
    assert(result.unwrap()[0] != CRED_VALUE_1[0]);
}

/// rotate_credential() on a non-existent key_id reverts.
#[test(should_fail_with = "No credential found for key_id -- cannot rotate a non-existent credential")]
unconstrained fn test_rotate_nonexistent_credential_reverts() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();
    env.call_private(
        agent,
        IsnadRegistry::at(addr).rotate_credential(KEY_OPENAI, CRED_VALUE_2, CRED_LABEL),
    );
}

/// Rotating credential A does not affect credential B.
#[test]
unconstrained fn test_rotate_does_not_affect_other_credential() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_GITHUB, CRED_VALUE_2, CRED_LABEL),
    );

    env.call_private(
        agent,
        IsnadRegistry::at(addr).rotate_credential(KEY_OPENAI, CRED_VALUE_2, CRED_LABEL),
    );

    let github = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_GITHUB));
    assert(github.is_some());
    assert_eq(github.unwrap()[0], CRED_VALUE_2[0]);
}

// === END-TO-END SCENARIOS =====================================================

/// Full agent security lifecycle with chain-of-trust:
/// Admin adds root auditor -> auditor attests skill -> agent checks score and installs
/// -> auditor discovers skill is malicious -> revokes -> score drops -> agents stop installing
#[test]
unconstrained fn test_full_security_lifecycle() {
    let (mut env, addr, admin) = setup();
    let auditor = env.create_light_account();
    let agent = env.create_light_account();

    // Step 0: Admin establishes the Isnad chain
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(auditor));

    // Step 1: Auditor reviews and attests the skill (quality=88, root depth)
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 88, CLAIM_CODE_REVIEW));

    // Step 2: Agent checks trust score (88*4=352) and decides to install
    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    assert(score > 50u64); // Threshold: only install if score > 50

    // Step 3: Agent stores an API key in the vault
    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_some());

    // Step 4: Auditor discovers the skill was compromised -- revokes attestation
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    // Step 5: Trust score drops to 0 -- other agents won't install it
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 0u64);

    // Step 6: Agent's stored credential is still safe (unaffected by revocation)
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_some());
}

/// Trust building to TRUSTED tier: 3 root auditors, combined score reaches TRUSTED threshold.
/// The Isnad chain ensures all 3 attestors are verified before their scores count.
#[test]
unconstrained fn test_trust_reaches_trusted_tier() {
    let (mut env, addr, admin) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();
    let carol = env.create_light_account();

    // All three are root attestors -- admin vouches for each
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(alice));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(bob));
    env.call_private(admin, IsnadRegistry::at(addr).add_root_attestor(carol));

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_CODE_REVIEW));
    env.call_private(bob, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_BEHAVIORAL));
    env.call_private(carol, IsnadRegistry::at(addr).attest(SKILL_A, 92, CLAIM_SANDBOXED));

    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    let count = env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A));

    // alice: 90*4=360, bob: 85*4=340, carol: 92*4=368, total=1068
    // clawde.co TRUSTED tier: count >= 3 AND score >= 150 (well exceeded)
    assert(count >= 3u64);
    assert(score >= 150u64);
}

/// Mixed chain depth scenario: root + depth-1 + depth-2 attestors combine on one skill.
#[test]
unconstrained fn test_mixed_depth_attestors_accumulate() {
    let (mut env, addr, _admin, root) = setup_with_root_auditor();
    let depth1 = env.create_light_account();
    let depth2 = env.create_light_account();

    env.call_private(root, IsnadRegistry::at(addr).vouch(depth1));
    env.call_private(depth1, IsnadRegistry::at(addr).vouch(depth2));

    // root: quality=100 -> 100*4=400
    env.call_private(root, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));
    // depth1: quality=100 -> 100*3=300
    env.call_private(depth1, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_BEHAVIORAL));
    // depth2: quality=100 -> 100*2=200
    env.call_private(depth2, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_SANDBOXED));

    // Total score: 400+300+200=900, count=3
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 900u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 3u64);
}
