/**
 * Fetches data from primary URL, falling back to secondary on failure
 * @internal Exported for testing
 */
export declare function fetchWithFallback(primaryUrl: string, fallbackUrl: string, options: RequestInit): Promise<Response>;
/**
 * Downloader for CRS from the web or local.
 */
export declare class NetCrs {
    readonly numPoints: number;
    private data;
    private g2Data;
    constructor(
    /**
     * The number of circuit gates.
     */
    numPoints: number);
    /**
     * Download the data.
     */
    init(): Promise<void>;
    /**
     * Opens up a ReadableStream to the points data
     */
    streamG1Data(): Promise<ReadableStream<Uint8Array>>;
    /**
     * Opens up a ReadableStream to the points data
     */
    streamG2Data(): Promise<ReadableStream<Uint8Array>>;
    downloadG1Data(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * Download the G2 points data.
     */
    downloadG2Data(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data(): Uint8Array;
    /**
     * G2 points data for verification key.
     * @returns The points data.
     */
    getG2Data(): Uint8Array;
    private fetchG1Data;
    private fetchG2Data;
}
/**
 * Downloader for CRS from the web or local.
 */
export declare class NetGrumpkinCrs {
    readonly numPoints: number;
    private data;
    constructor(
    /**
     * The number of circuit gates.
     */
    numPoints: number);
    /**
     * Download the data.
     */
    init(): Promise<void>;
    downloadG1Data(): Promise<Uint8Array<ArrayBuffer>>;
    /**
     * Opens up a ReadableStream to the points data
     */
    streamG1Data(): Promise<ReadableStream<Uint8Array>>;
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data(): Uint8Array;
    private fetchG1Data;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0X2Nycy5kLnRzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2Nycy9uZXRfY3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU9BOzs7R0FHRztBQUNILHdCQUFzQixpQkFBaUIsQ0FDckMsVUFBVSxFQUFFLE1BQU0sRUFDbEIsV0FBVyxFQUFFLE1BQU0sRUFDbkIsT0FBTyxFQUFFLFdBQVcsR0FDbkIsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQVVuQjtBQUVEOztHQUVHO0FBQ0gscUJBQWEsTUFBTTthQVFDLFNBQVMsRUFBRSxNQUFNO0lBUG5DLE9BQU8sQ0FBQyxJQUFJLENBQWM7SUFDMUIsT0FBTyxDQUFDLE1BQU0sQ0FBYztJQUU1QjtJQUNFOztPQUVHO0lBQ2EsU0FBUyxFQUFFLE1BQU0sRUFDL0I7SUFFSjs7T0FFRztJQUNHLElBQUksa0JBR1Q7SUFFRDs7T0FFRztJQUNHLFlBQVksSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBR3hEO0lBRUQ7O09BRUc7SUFDRyxZQUFZLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUd4RDtJQUVLLGNBQWMscUNBR25CO0lBRUQ7O09BRUc7SUFDRyxjQUFjLHFDQUduQjtJQUVEOzs7T0FHRztJQUNILFNBQVMsSUFBSSxVQUFVLENBRXRCO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyxJQUFJLFVBQVUsQ0FFdEI7WUFLYSxXQUFXO1lBc0JYLFdBQVc7Q0FTMUI7QUFFRDs7R0FFRztBQUNILHFCQUFhLGNBQWM7YUFPUCxTQUFTLEVBQUUsTUFBTTtJQU5uQyxPQUFPLENBQUMsSUFBSSxDQUFjO0lBRTFCO0lBQ0U7O09BRUc7SUFDYSxTQUFTLEVBQUUsTUFBTSxFQUMvQjtJQUVKOztPQUVHO0lBQ0csSUFBSSxrQkFFVDtJQUVLLGNBQWMscUNBR25CO0lBRUQ7O09BRUc7SUFDRyxZQUFZLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUd4RDtJQUVEOzs7T0FHRztJQUNILFNBQVMsSUFBSSxVQUFVLENBRXRCO1lBS2EsV0FBVztDQW9CMUIifQ==