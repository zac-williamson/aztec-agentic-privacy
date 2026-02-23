import { Barretenberg } from './index.js';
import { ProofData } from '../proof/index.js';
export declare class AztecClientBackendError extends Error {
    constructor(message: string);
}
/**
 * Target verification environment for proof generation.
 * This determines the hash function used and whether zero-knowledge is enabled.
 */
export type VerifierTarget = 'evm' | 'evm-no-zk' | 'noir-recursive' | 'noir-recursive-no-zk' | 'noir-rollup' | 'noir-rollup-no-zk' | 'starknet' | 'starknet-no-zk';
/**
 * Options for the UltraHonkBackend.
 */
export type UltraHonkBackendOptions = {
    /**
     * Target verification environment. Determines hash function and ZK settings.
     * This is the recommended way to configure proof generation.
     *
     * @example
     * // For EVM/Solidity verification
     * backend.generateProof(witness, { verifierTarget: 'evm' });
     *
     * // For recursive verification in Noir
     * backend.generateProof(witness, { verifierTarget: 'noir-recursive' });
     */
    verifierTarget?: VerifierTarget;
    /** @deprecated Use verifierTarget: 'evm-no-zk' instead */
    keccak?: boolean;
    /** @deprecated Use verifierTarget: 'evm' instead */
    keccakZK?: boolean;
    /** @deprecated Use verifierTarget: 'starknet-no-zk' instead */
    starknet?: boolean;
    /** @deprecated Use verifierTarget: 'starknet' instead */
    starknetZK?: boolean;
};
export declare class UltraHonkVerifierBackend {
    private api;
    constructor(api: Barretenberg);
    verifyProof(proofData: ProofData & {
        verificationKey: Uint8Array;
    }, options?: UltraHonkBackendOptions): Promise<boolean>;
}
export declare class UltraHonkBackend {
    private api;
    private acirUncompressedBytecode;
    constructor(acirBytecode: string, api: Barretenberg);
    generateProof(compressedWitness: Uint8Array, options?: UltraHonkBackendOptions): Promise<ProofData>;
    verifyProof(proofData: ProofData, options?: UltraHonkBackendOptions): Promise<boolean>;
    getVerificationKey(options?: UltraHonkBackendOptions): Promise<Uint8Array>;
    /** @description Returns a solidity verifier */
    getSolidityVerifier(vk: Uint8Array, options?: UltraHonkBackendOptions): Promise<string>;
    generateRecursiveProofArtifacts(_proof: Uint8Array, _numOfPublicInputs: number, options?: UltraHonkBackendOptions): Promise<{
        proofAsFields: string[];
        vkAsFields: string[];
        vkHash: string;
    }>;
}
export declare class AztecClientBackend {
    private acirBuf;
    private api;
    private circuitNames;
    constructor(acirBuf: Uint8Array[], api: Barretenberg, circuitNames?: string[]);
    prove(witnessBuf: Uint8Array[], vksBuf?: Uint8Array[]): Promise<[Uint8Array[], Uint8Array, Uint8Array]>;
    verify(proof: Uint8Array, vk: Uint8Array): Promise<boolean>;
    private verifyNative;
    gates(): Promise<number[]>;
}
/**
 * Convert a field element (32-byte Uint8Array) to a string.
 *
 * @param field - A 32-byte field element
 * @param radix - The radix for string conversion (2-36), defaults to 10 (decimal)
 * @returns The field value as a string in the specified radix
 *
 * @example
 * const decimal = fieldToString(field);        // "12345678"
 * const hex = fieldToString(field, 16);        // "bc614e"
 */
export declare function fieldToString(field: Uint8Array, radix?: number): string;
/**
 * Convert an array of field elements to an array of strings.
 * Useful for passing VK fields to Noir circuits.
 *
 * @param fields - Array of 32-byte field elements
 * @param radix - The radix for string conversion (2-36), defaults to 10 (decimal)
 * @returns Array of strings in the specified radix
 *
 * @example
 * const vkAsFields = await barretenbergAPI.vkAsFields({ verificationKey: vk });
 * const vkDecimalStrings = fieldsToStrings(vkAsFields.fields);      // ["12345678", "87654321", ...]
 * const vkHexStrings = fieldsToStrings(vkAsFields.fields, 16);      // ["bc614e", "5397fb1", ...]
 */
export declare function fieldsToStrings(fields: Uint8Array[], radix?: number): string[];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC5kLnRzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JhcnJldGVuYmVyZy9iYWNrZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDMUMsT0FBTyxFQUFFLFNBQVMsRUFBb0MsTUFBTSxtQkFBbUIsQ0FBQztBQUtoRixxQkFBYSx1QkFBd0IsU0FBUSxLQUFLO0lBQ2hELFlBQVksT0FBTyxFQUFFLE1BQU0sRUFFMUI7Q0FDRjtBQUVEOzs7R0FHRztBQUNILE1BQU0sTUFBTSxjQUFjLEdBQ3RCLEtBQUssR0FDTCxXQUFXLEdBQ1gsZ0JBQWdCLEdBQ2hCLHNCQUFzQixHQUN0QixhQUFhLEdBQ2IsbUJBQW1CLEdBQ25CLFVBQVUsR0FDVixnQkFBZ0IsQ0FBQztBQUVyQjs7R0FFRztBQUNILE1BQU0sTUFBTSx1QkFBdUIsR0FBRztJQUNwQzs7Ozs7Ozs7OztPQVVHO0lBQ0gsY0FBYyxDQUFDLEVBQUUsY0FBYyxDQUFDO0lBSWhDLDBEQUEwRDtJQUMxRCxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUM7SUFDakIsb0RBQW9EO0lBQ3BELFFBQVEsQ0FBQyxFQUFFLE9BQU8sQ0FBQztJQUNuQiwrREFBK0Q7SUFDL0QsUUFBUSxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ25CLHlEQUF5RDtJQUN6RCxVQUFVLENBQUMsRUFBRSxPQUFPLENBQUM7Q0FDdEIsQ0FBQztBQWtGRixxQkFBYSx3QkFBd0I7SUFDdkIsT0FBTyxDQUFDLEdBQUc7SUFBdkIsWUFBb0IsR0FBRyxFQUFFLFlBQVksRUFBSTtJQUVuQyxXQUFXLENBQ2YsU0FBUyxFQUFFLFNBQVMsR0FBRztRQUFFLGVBQWUsRUFBRSxVQUFVLENBQUE7S0FBRSxFQUN0RCxPQUFPLENBQUMsRUFBRSx1QkFBdUIsR0FDaEMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQVlsQjtDQUNGO0FBRUQscUJBQWEsZ0JBQWdCO0lBVXpCLE9BQU8sQ0FBQyxHQUFHO0lBSmIsT0FBTyxDQUFDLHdCQUF3QixDQUFhO0lBRTdDLFlBQ0UsWUFBWSxFQUFFLE1BQU0sRUFDWixHQUFHLEVBQUUsWUFBWSxFQUcxQjtJQUVLLGFBQWEsQ0FBQyxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUUsdUJBQXVCLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQW9CeEc7SUFFSyxXQUFXLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsRUFBRSx1QkFBdUIsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBb0IzRjtJQUVLLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxFQUFFLHVCQUF1QixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FTL0U7SUFFRCwrQ0FBK0M7SUFDekMsbUJBQW1CLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRSx1QkFBdUIsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBTTVGO0lBR0ssK0JBQStCLENBRW5DLE1BQU0sRUFBRSxVQUFVLEVBRWxCLGtCQUFrQixFQUFFLE1BQU0sRUFDMUIsT0FBTyxDQUFDLEVBQUUsdUJBQXVCLEdBQ2hDLE9BQU8sQ0FBQztRQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsQ0FBQztRQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsQ0FBQztRQUFDLE1BQU0sRUFBRSxNQUFNLENBQUE7S0FBRSxDQUFDLENBaUM1RTtDQUNGO0FBRUQscUJBQWEsa0JBQWtCO0lBTzNCLE9BQU8sQ0FBQyxPQUFPO0lBQ2YsT0FBTyxDQUFDLEdBQUc7SUFDWCxPQUFPLENBQUMsWUFBWTtJQUh0QixZQUNVLE9BQU8sRUFBRSxVQUFVLEVBQUUsRUFDckIsR0FBRyxFQUFFLFlBQVksRUFDakIsWUFBWSxHQUFFLE1BQU0sRUFBTyxFQUNqQztJQUVFLEtBQUssQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLEVBQUUsTUFBTSxHQUFFLFVBQVUsRUFBTyxHQUFHLE9BQU8sQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQTREaEg7SUFFSyxNQUFNLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsVUFBVSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FNaEU7WUFNYSxZQUFZO0lBUXBCLEtBQUssSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FhL0I7Q0FDRjtBQWlCRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsd0JBQWdCLGFBQWEsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLEtBQUssR0FBRSxNQUFXLEdBQUcsTUFBTSxDQU8zRTtBQUVEOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILHdCQUFnQixlQUFlLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxFQUFFLEtBQUssR0FBRSxNQUFXLEdBQUcsTUFBTSxFQUFFLENBRWxGIn0=