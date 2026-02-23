/**
 * @description
 * The representation of a proof
 * */
export type ProofData = {
    /** @description Public inputs of a proof */
    publicInputs: string[];
    /** @description An byte array representing the proof */
    proof: Uint8Array;
};
export declare const PAIRING_POINTS_SIZE = 16;
export declare function splitHonkProof(proofWithPublicInputs: Uint8Array, numPublicInputs: number): {
    publicInputs: Uint8Array;
    proof: Uint8Array;
};
export declare function reconstructHonkProof(publicInputs: Uint8Array, proof: Uint8Array): Uint8Array;
export declare function deflattenFields(flattenedFields: Uint8Array): string[];
export declare function flattenFieldsAsArray(fields: string[]): Uint8Array;
export declare function uint8ArrayToHex(buffer: Uint8Array): string;
export declare function hexToUint8Array(hex: string): Uint8Array;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm9vZi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0tBR0s7QUFDTCxNQUFNLE1BQU0sU0FBUyxHQUFHO0lBQ3RCLDRDQUE0QztJQUM1QyxZQUFZLEVBQUUsTUFBTSxFQUFFLENBQUM7SUFDdkIsd0RBQXdEO0lBQ3hELEtBQUssRUFBRSxVQUFVLENBQUM7Q0FDbkIsQ0FBQztBQUVGLGVBQU8sTUFBTSxtQkFBbUIsS0FBSyxDQUFDO0FBS3RDLHdCQUFnQixjQUFjLENBQzVCLHFCQUFxQixFQUFFLFVBQVUsRUFDakMsZUFBZSxFQUFFLE1BQU0sR0FDdEI7SUFBRSxZQUFZLEVBQUUsVUFBVSxDQUFDO0lBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQTtDQUFFLENBUWpEO0FBRUQsd0JBQWdCLG9CQUFvQixDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFVBQVUsR0FBRyxVQUFVLENBRzVGO0FBRUQsd0JBQWdCLGVBQWUsQ0FBQyxlQUFlLEVBQUUsVUFBVSxHQUFHLE1BQU0sRUFBRSxDQVVyRTtBQUVELHdCQUFnQixvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsVUFBVSxDQUdqRTtBQWVELHdCQUFnQixlQUFlLENBQUMsTUFBTSxFQUFFLFVBQVUsR0FBRyxNQUFNLENBWTFEO0FBRUQsd0JBQWdCLGVBQWUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxHQUFHLFVBQVUsQ0FldkQifQ==