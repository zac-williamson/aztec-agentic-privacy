/**
 * Downloader for CRS from the web or local.
 */
export declare class CachedNetCrs {
    readonly numPoints: number;
    private g1Data;
    private g2Data;
    constructor(numPoints: number);
    static new(numPoints: number): Promise<CachedNetCrs>;
    /**
     * Download the data.
     */
    init(): Promise<void>;
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
}
/**
 * Downloader for CRS from the web or local.
 */
export declare class CachedNetGrumpkinCrs {
    readonly numPoints: number;
    private g1Data;
    constructor(numPoints: number);
    static new(numPoints: number): Promise<CachedNetGrumpkinCrs>;
    /**
     * Download the data.
     */
    init(): Promise<void>;
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data(): Uint8Array;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkX25ldF9jcnMuZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9jcnMvYnJvd3Nlci9jYWNoZWRfbmV0X2Nycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFHQTs7R0FFRztBQUNILHFCQUFhLFlBQVk7YUFJSyxTQUFTLEVBQUUsTUFBTTtJQUg3QyxPQUFPLENBQUMsTUFBTSxDQUFjO0lBQzVCLE9BQU8sQ0FBQyxNQUFNLENBQWM7SUFFNUIsWUFBNEIsU0FBUyxFQUFFLE1BQU0sRUFBSTtJQUVqRCxPQUFhLEdBQUcsQ0FBQyxTQUFTLEVBQUUsTUFBTSx5QkFJakM7SUFFRDs7T0FFRztJQUNHLElBQUksa0JBb0JUO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyxJQUFJLFVBQVUsQ0FFdEI7SUFFRDs7O09BR0c7SUFDSCxTQUFTLElBQUksVUFBVSxDQUV0QjtDQUNGO0FBRUQ7O0dBRUc7QUFDSCxxQkFBYSxvQkFBb0I7YUFHSCxTQUFTLEVBQUUsTUFBTTtJQUY3QyxPQUFPLENBQUMsTUFBTSxDQUFjO0lBRTVCLFlBQTRCLFNBQVMsRUFBRSxNQUFNLEVBQUk7SUFFakQsT0FBYSxHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0saUNBSWpDO0lBRUQ7O09BRUc7SUFDRyxJQUFJLGtCQVlUO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyxJQUFJLFVBQVUsQ0FFdEI7Q0FDRiJ9