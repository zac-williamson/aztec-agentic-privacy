import { retry, makeBackoff } from '../retry/index.js';
// Primary CRS host (Cloudflare R2)
const CRS_PRIMARY_HOST = 'https://crs.aztec-cdn.foundation';
// Fallback CRS host (AWS S3)
const CRS_FALLBACK_HOST = 'https://crs.aztec-labs.com';
/**
 * Fetches data from primary URL, falling back to secondary on failure
 * @internal Exported for testing
 */
export async function fetchWithFallback(primaryUrl, fallbackUrl, options) {
    try {
        const response = await fetch(primaryUrl, options);
        if (response.ok || response.status === 206) {
            return response;
        }
        throw new Error(`HTTP ${response.status}`);
    }
    catch {
        return await fetch(fallbackUrl, options);
    }
}
/**
 * Downloader for CRS from the web or local.
 */
export class NetCrs {
    numPoints;
    data;
    g2Data;
    constructor(
    /**
     * The number of circuit gates.
     */
    numPoints) {
        this.numPoints = numPoints;
    }
    /**
     * Download the data.
     */
    async init() {
        await this.downloadG1Data();
        await this.downloadG2Data();
    }
    /**
     * Opens up a ReadableStream to the points data
     */
    async streamG1Data() {
        const response = await this.fetchG1Data();
        return response.body;
    }
    /**
     * Opens up a ReadableStream to the points data
     */
    async streamG2Data() {
        const response = await this.fetchG2Data();
        return response.body;
    }
    async downloadG1Data() {
        const response = await this.fetchG1Data();
        return (this.data = new Uint8Array(await response.arrayBuffer()));
    }
    /**
     * Download the G2 points data.
     */
    async downloadG2Data() {
        const response2 = await this.fetchG2Data();
        return (this.g2Data = new Uint8Array(await response2.arrayBuffer()));
    }
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data() {
        return this.data;
    }
    /**
     * G2 points data for verification key.
     * @returns The points data.
     */
    getG2Data() {
        return this.g2Data;
    }
    /**
     * Fetches the appropriate range of points from a remote source
     */
    async fetchG1Data() {
        // Skip the download if numPoints is 0 (would download the entire file due to bad range header otherwise)
        if (this.numPoints === 0) {
            return new Response(new Uint8Array([]));
        }
        const g1End = this.numPoints * 64 - 1;
        const options = {
            headers: {
                Range: `bytes=0-${g1End}`,
            },
            cache: 'force-cache',
        };
        return await retry(() => fetchWithFallback(`${CRS_PRIMARY_HOST}/g1.dat`, `${CRS_FALLBACK_HOST}/g1.dat`, options), makeBackoff([5, 5, 5]));
    }
    /**
     * Fetches the appropriate range of points from a remote source
     */
    async fetchG2Data() {
        const options = {
            cache: 'force-cache',
        };
        return await retry(() => fetchWithFallback(`${CRS_PRIMARY_HOST}/g2.dat`, `${CRS_FALLBACK_HOST}/g2.dat`, options), makeBackoff([5, 5, 5]));
    }
}
/**
 * Downloader for CRS from the web or local.
 */
export class NetGrumpkinCrs {
    numPoints;
    data;
    constructor(
    /**
     * The number of circuit gates.
     */
    numPoints) {
        this.numPoints = numPoints;
    }
    /**
     * Download the data.
     */
    async init() {
        await this.downloadG1Data();
    }
    async downloadG1Data() {
        const response = await this.fetchG1Data();
        return (this.data = new Uint8Array(await response.arrayBuffer()));
    }
    /**
     * Opens up a ReadableStream to the points data
     */
    async streamG1Data() {
        const response = await this.fetchG1Data();
        return response.body;
    }
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data() {
        return this.data;
    }
    /**
     * Fetches the appropriate range of points from a remote source
     */
    async fetchG1Data() {
        // Skip the download if numPoints is 0 (would download the entire file due to bad range header otherwise)
        if (this.numPoints === 0) {
            return new Response(new Uint8Array([]));
        }
        const g1End = this.numPoints * 64 - 1;
        const options = {
            headers: {
                Range: `bytes=0-${g1End}`,
            },
            cache: 'force-cache',
        };
        return await fetchWithFallback(`${CRS_PRIMARY_HOST}/grumpkin_g1.dat`, `${CRS_FALLBACK_HOST}/grumpkin_g1.dat`, options);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0X2Nycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jcnMvbmV0X2Nycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRXZELG1DQUFtQztBQUNuQyxNQUFNLGdCQUFnQixHQUFHLGtDQUFrQyxDQUFDO0FBQzVELDZCQUE2QjtBQUM3QixNQUFNLGlCQUFpQixHQUFHLDRCQUE0QixDQUFDO0FBRXZEOzs7R0FHRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLFVBQWtCLEVBQ2xCLFdBQW1CLEVBQ25CLE9BQW9CLEVBQ0Q7SUFDbkIsSUFBSSxDQUFDO1FBQ0gsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xELElBQUksUUFBUSxDQUFDLEVBQUUsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQzNDLE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLFFBQVEsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sTUFBTSxLQUFLLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFBQSxDQUNGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sTUFBTTtJQVFDLFNBQVM7SUFQbkIsSUFBSSxDQUFjO0lBQ2xCLE1BQU0sQ0FBYztJQUU1QjtJQUNFOztPQUVHO0lBQ2EsU0FBaUIsRUFDakM7eUJBRGdCLFNBQVM7SUFDeEIsQ0FBQztJQUVKOztPQUVHO0lBQ0gsS0FBSyxDQUFDLElBQUksR0FBRztRQUNYLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzVCLE1BQU0sSUFBSSxDQUFD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