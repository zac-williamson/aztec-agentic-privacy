/**
 * Shared naming utilities for code generators
 */
/**
 * Convert camelCase or PascalCase to snake_case
 * @example toSnakeCase("Blake2s") -> "blake2s"
 * @example toSnakeCase("poseidonHash") -> "poseidon_hash"
 */
export function toSnakeCase(name) {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
/**
 * Convert snake_case to PascalCase
 * @example toPascalCase("blake2s") -> "Blake2s"
 * @example toPascalCase("poseidon_hash") -> "PoseidonHash"
 */
export function toPascalCase(name) {
    // Already PascalCase (no underscores and starts with uppercase)
    if (!name.includes('_') && name[0] === name[0].toUpperCase()) {
        return name;
    }
    return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmFtaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NiaW5kL25hbWluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7R0FFRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUFDLElBQVksRUFBVTtJQUNoRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFBQSxDQUN4RTtBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsWUFBWSxDQUFDLElBQVksRUFBVTtJQUNqRCxnRUFBZ0U7SUFDaEUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1FBQzdELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDaEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUMzRCxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUFBLENBQ1oifQ==