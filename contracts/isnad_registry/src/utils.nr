/// Compute the effective quality contribution for a given chain depth.
///
/// Attestations closer to the root of the Isnad chain carry more authority.
/// Weight table:
///   depth=0 (root):  weight=4 (directly authorized by admin)
///   depth=1:         weight=3 (vouched by root)
///   depth=2:         weight=2 (vouched by depth-1)
///   depth=3+:        weight=1 (minimum, still counted)
///
/// effective_quality = quality * weight(depth)
/// This is the value added to the public trust score.
pub fn compute_effective_quality(quality: u8, depth: u8) -> u64 {
    let weight: u64 = if depth == 0 {
        4
    } else if depth == 1 {
        3
    } else if depth == 2 {
        2
    } else {
        1
    };
    (quality as u64) * weight
}
