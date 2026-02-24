/// IsnadRegistry Contract Tests
///
/// Tests for attest(), revoke_attestation(), and the credential vault (store_credential,
/// get_credential, delete_credential, rotate_credential) using the Aztec v4 TestEnvironment.
///
/// TestEnvironment uses TXE (Transaction Execution Environment) oracles to simulate the full
/// Aztec execution stack: private proof generation, public state, note hash tree, nullifier
/// tree -- without requiring a live Aztec node.
///
/// === Running these tests =====================================================
///
///   REQUIRES TXE SERVER (blocked by GLIBC on this machine until Docker is resolved):
///     aztec test --watch         (starts TXE, then runs nargo test in a loop)
///     nargo test --oracle-resolver http://localhost:8080
///
///   COMPILE-ONLY CHECK (no TXE needed, just verifies Noir syntax and types):
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
/// In production: UTF-8 bytes of the secret packed into Fields (31 bytes per Field).
global CRED_VALUE_1: [Field; 4] = [0x01, 0x02, 0x03, 0x04];
global CRED_VALUE_2: [Field; 4] = [0x0a, 0x0b, 0x0c, 0x0d];
/// "OpenAI" as ASCII bytes packed into a Field (fits comfortably within BN254).
global CRED_LABEL: Field = 0x4f70656e4149;

/// Deploy IsnadRegistry and return (env, contract_address, deployer).
unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let deployer = env.create_light_account();
    let contract_addr = env.deploy("IsnadRegistry").with_public_initializer(
        deployer,
        IsnadRegistry::interface().constructor(),
    );
    (env, contract_addr, deployer)
}

// === TRUST SCORE QUERIES =====================================================
//
// Verify that public view functions return correct initial state and that
// attestation scores accumulate correctly.

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

/// attest() with quality=85 and claim_type=0 (code_review) increments trust score.
#[test]
unconstrained fn test_attest_increments_trust_score() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));

    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    assert_eq(score, 85u64);
}

/// attest() increments attestation count to 1.
#[test]
unconstrained fn test_attest_increments_attestation_count() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 70, CLAIM_BEHAVIORAL));

    let count = env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A));
    assert_eq(count, 1u64);
}

/// attest() with quality=0 (minimum): count increments but score stays at 0.
#[test]
unconstrained fn test_attest_with_minimum_quality() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 0, CLAIM_CODE_REVIEW));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// attest() with quality=100 (maximum): score = 100, count = 1.
#[test]
unconstrained fn test_attest_with_maximum_quality() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 100, CLAIM_CODE_REVIEW));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 100u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// claim_type=1 (behavioral) is accepted.
#[test]
unconstrained fn test_attest_with_claim_type_behavioral() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 75, CLAIM_BEHAVIORAL));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 75u64);
}

/// claim_type=2 (sandboxed_execution) is accepted.
#[test]
unconstrained fn test_attest_with_claim_type_sandboxed() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 95, CLAIM_SANDBOXED));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 95u64);
}

/// Two distinct auditors attesting the same skill accumulate scores independently.
/// Final score = sum of both qualities. Final count = 2.
#[test]
unconstrained fn test_two_auditors_accumulate_scores() {
    let (mut env, addr, _) = setup();
    let auditor_1 = env.create_light_account();
    let auditor_2 = env.create_light_account();

    env.call_private(auditor_1, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor_2, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_BEHAVIORAL));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 170u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 2u64);
}

/// Three auditors with different claim_types accumulate correctly.
#[test]
unconstrained fn test_three_auditors_genesis_set() {
    let (mut env, addr, _) = setup();
    let kobold = env.create_light_account();
    let hk47 = env.create_light_account();
    let syntrax = env.create_light_account();

    env.call_private(kobold, IsnadRegistry::at(addr).attest(SKILL_A, 82, CLAIM_CODE_REVIEW));
    env.call_private(hk47, IsnadRegistry::at(addr).attest(SKILL_A, 78, CLAIM_BEHAVIORAL));
    env.call_private(syntrax, IsnadRegistry::at(addr).attest(SKILL_A, 95, CLAIM_SANDBOXED));

    // Expected: 82 + 78 + 95 = 255
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 255u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 3u64);
}

/// Trust scores of two different skills are independent.
/// Attesting SKILL_A has no effect on SKILL_B.
#[test]
unconstrained fn test_different_skills_have_independent_scores() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 75, CLAIM_CODE_REVIEW));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 75u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_B)), 0u64);
}

/// One auditor can attest multiple different skills independently.
#[test]
unconstrained fn test_one_auditor_attests_multiple_skills() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_B, 90, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_C, 85, CLAIM_CODE_REVIEW));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 80u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 90u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_C)), 85u64);
}

// === ATTESTATION: VALIDATION =================================================

/// quality > 100 is rejected -- the Noir assert fires.
#[test(should_fail_with = "quality must be in range 0-100")]
unconstrained fn test_attest_quality_above_100_reverts() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();
    // quality=101 should trigger: assert(quality <= 100, "quality must be in range 0-100")
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 101, CLAIM_CODE_REVIEW));
}

/// claim_type=3 (invalid) is rejected -- the Noir assert fires.
#[test(should_fail_with = "claim_type must be 0 (code_review), 1 (behavioral), or 2 (sandboxed_execution)")]
unconstrained fn test_attest_invalid_claim_type_reverts() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();
    // claim_type=3 should trigger the assert
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, 3));
}

/// Same auditor cannot attest the same skill twice (SingleUseClaim).
/// The second call reverts because the claim nullifier is already spent.
#[test(should_fail_with = "duplicate siloed nullifier")]
unconstrained fn test_double_attestation_reverts() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    // Second attest: SingleUseClaim nullifier is spent -- must revert
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_CODE_REVIEW));
}

/// Double-attest on SKILL_A does not block attest on SKILL_B by same auditor.
/// The claim key is (auditor, skill_hash) -- different skills have different keys.
#[test]
unconstrained fn test_double_attest_on_a_does_not_block_attest_on_b() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    // SKILL_B has a different claim key -- no conflict
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_B, 85, CLAIM_CODE_REVIEW));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 80u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 85u64);
}

// === REVOCATION ==============================================================

/// revoke_attestation() decrements trust score by the original quality.
#[test]
unconstrained fn test_revoke_decrements_trust_score() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 85u64);

    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
}

/// revoke_attestation() decrements attestation count to 0.
#[test]
unconstrained fn test_revoke_decrements_attestation_count() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 0u64);
}

/// Partial revocation: Alice revokes, Bob's score and count remain.
#[test]
unconstrained fn test_partial_revoke_leaves_other_auditor_score() {
    let (mut env, addr, _) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(bob, IsnadRegistry::at(addr).attest(SKILL_A, 70, CLAIM_BEHAVIORAL));
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 150u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 2u64);

    env.call_private(alice, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    // Only Bob's score (70) remains
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 70u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// Trust score does not go below 0 (safe subtraction guard in _decrement_score).
#[test]
unconstrained fn test_revoke_score_floor_at_zero() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 50, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
}

/// Revoking without a prior attestation reverts -- no note to pop.
#[test(should_fail_with = "No attestation found for this skill")]
unconstrained fn test_revoke_without_attestation_reverts() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
}

/// Cannot revoke another auditor's attestation (note is in a different PXE).
#[test(should_fail_with = "No attestation found for this skill")]
unconstrained fn test_revoke_different_auditor_attestation_reverts() {
    let (mut env, addr, _) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    // Bob tries to revoke Alice's attestation -- no note in Bob's PrivateSet
    env.call_private(bob, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
}

/// After revoking, the auditor cannot re-attest the same skill.
/// The SingleUseClaim nullifier is permanent -- emitted at first attest and never recycled.
#[test(should_fail_with = "duplicate siloed nullifier")]
unconstrained fn test_revoke_then_reattest_blocked_by_single_use_claim() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
    // Attempting to re-attest: SingleUseClaim nullifier is still spent
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
}

/// A second auditor CAN attest a skill that was previously revoked by the first auditor.
/// The SingleUseClaim is per (auditor, skill_hash) -- different auditors have independent claims.
#[test]
unconstrained fn test_second_auditor_can_attest_after_first_revokes() {
    let (mut env, addr, _) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(alice, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);

    // Bob (fresh identity) can still attest
    env.call_private(bob, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_BEHAVIORAL));
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 90u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 1u64);
}

/// Revoking one skill does not affect the auditor's attestation of a different skill.
#[test]
unconstrained fn test_revoke_skill_a_does_not_affect_skill_b() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();

    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 80, CLAIM_CODE_REVIEW));
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_B, 90, CLAIM_CODE_REVIEW));

    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_B)), 90u64);
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

    // Alice sees her own value
    let alice_result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(alice, KEY_OPENAI));
    assert(alice_result.is_some());
    assert_eq(alice_result.unwrap()[0], CRED_VALUE_1[0]);

    // Bob sees his own value (not Alice's)
    let bob_result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(bob, KEY_OPENAI));
    assert(bob_result.is_some());
    assert_eq(bob_result.unwrap()[0], CRED_VALUE_2[0]);

    // Alice cannot see Bob's vault entry for KEY_GITHUB (not stored)
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
    // Verify stored
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_some());

    env.call_private(agent, IsnadRegistry::at(addr).delete_credential(KEY_OPENAI));

    // Credential should be gone
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

    // KEY_OPENAI is deleted
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_none());
    // KEY_GITHUB is intact
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
/// After rotation, get_credential() returns the new value.
#[test]
unconstrained fn test_rotate_credential_updates_value() {
    let (mut env, addr, _) = setup();
    let agent = env.create_light_account();

    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );

    // Rotate to new value
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

    // Third version: reverse of CRED_VALUE_2
    let v3: [Field; 4] = [0x0d, 0x0c, 0x0b, 0x0a];
    env.call_private(
        agent,
        IsnadRegistry::at(addr).rotate_credential(KEY_OPENAI, v3, CRED_LABEL),
    );

    let result = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI));
    assert(result.is_some());
    assert_eq(result.unwrap()[0], v3[0]);
    // Original CRED_VALUE_1[0] should NOT be current value
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

    // KEY_GITHUB is untouched (still CRED_VALUE_2[0])
    let github = env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_GITHUB));
    assert(github.is_some());
    assert_eq(github.unwrap()[0], CRED_VALUE_2[0]);
}

// === END-TO-END SCENARIO =====================================================

/// Full agent security lifecycle:
/// Audit skill -> check trust score -> store API key -> skill gets compromised -> revoke
#[test]
unconstrained fn test_full_security_lifecycle() {
    let (mut env, addr, _) = setup();
    let auditor = env.create_light_account();
    let agent = env.create_light_account();

    // Step 1: Auditor reviews and attests the skill
    env.call_private(auditor, IsnadRegistry::at(addr).attest(SKILL_A, 88, CLAIM_CODE_REVIEW));

    // Step 2: Agent checks trust score and decides to install
    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    assert(score > 50u64); // Threshold: only install if score > 50

    // Step 3: Agent stores an API key in the vault
    env.call_private(
        agent,
        IsnadRegistry::at(addr).store_credential(KEY_OPENAI, CRED_VALUE_1, CRED_LABEL),
    );
    // Key is safely stored and retrievable
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_some());

    // Step 4: Auditor discovers the skill was compromised -- revokes attestation
    env.call_private(auditor, IsnadRegistry::at(addr).revoke_attestation(SKILL_A));

    // Step 5: Trust score drops to 0 -- other agents won't install it
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A)), 0u64);
    assert_eq(env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A)), 0u64);

    // Step 6: Agent's stored credential is still safe (private, not affected by revocation)
    assert(env.simulate_utility(IsnadRegistry::at(addr).get_credential(agent, KEY_OPENAI)).is_some());
}

/// Trust building to TRUSTED tier: 3+ auditors, combined score >= 150 (clawde.co threshold).
#[test]
unconstrained fn test_trust_reaches_trusted_tier() {
    let (mut env, addr, _) = setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();
    let carol = env.create_light_account();

    env.call_private(alice, IsnadRegistry::at(addr).attest(SKILL_A, 90, CLAIM_CODE_REVIEW));
    env.call_private(bob, IsnadRegistry::at(addr).attest(SKILL_A, 85, CLAIM_BEHAVIORAL));
    env.call_private(carol, IsnadRegistry::at(addr).attest(SKILL_A, 92, CLAIM_SANDBOXED));

    let score = env.view_public(IsnadRegistry::at(addr).get_trust_score(SKILL_A));
    let count = env.view_public(IsnadRegistry::at(addr).get_attestation_count(SKILL_A));

    // clawde.co TRUSTED tier: count >= 3 AND score >= 150
    assert(count >= 3u64);
    assert(score >= 150u64);
}
