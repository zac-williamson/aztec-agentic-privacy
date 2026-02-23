import { AsyncApi } from '../cbind/generated/async.js';
import { SyncApi } from '../cbind/generated/sync.js';
import { IMsgpackBackendSync, IMsgpackBackendAsync } from '../bb_backends/interface.js';
import { BackendOptions } from '../bb_backends/index.js';
export { UltraHonkBackend, UltraHonkVerifierBackend, AztecClientBackend, fieldToString, fieldsToStrings, type UltraHonkBackendOptions, type VerifierTarget, } from './backend.js';
export * from '../bb_backends/index.js';
export type CircuitOptions = {
    /** @description Whether to produce SNARK friendly proofs */
    recursive: boolean;
};
/**
 * The main class library consumers interact with.
 * It extends the generated api, and provides a static constructor "new" to compose components.
 */
export declare class Barretenberg extends AsyncApi {
    private options;
    constructor(backend: IMsgpackBackendAsync, options: BackendOptions);
    /**
     * Constructs an instance of Barretenberg.
     *
     * If options.backend is set: uses that specific backend (throws if unavailable)
     * If options.backend is unset: tries backends in order with fallback:
     *   1. NativeUnixSocket (if bb binary available)
     *   2. WasmWorker (in browser) or Wasm (in Node.js)
     */
    static new(options?: BackendOptions): Promise<Barretenberg>;
    initSRSChonk(srsSize?: number): Promise<void>;
    getDefaultSrsSize(): number;
    acirGetCircuitSizes(bytecode: Uint8Array, recursive: boolean, honkRecursion: boolean): Promise<[number, number]>;
    destroy(): Promise<void>;
    /**
     * Initialize the singleton instance of Barretenberg.
     * @param options Backend configuration options
     */
    static initSingleton(options?: BackendOptions): Promise<Barretenberg>;
    static destroySingleton(): Promise<void>;
    /**
     * Get the singleton instance of Barretenberg.
     * Must call initSingleton() first.
     */
    static getSingleton(): Barretenberg;
}
export declare class BarretenbergSync extends SyncApi {
    constructor(backend: IMsgpackBackendSync);
    /**
     * Create a new BarretenbergSync instance.
     *
     * If options.backend is set: uses that specific backend (throws if unavailable)
     * If options.backend is unset: tries backends in order with fallback:
     *   1. NativeSharedMem (if bb binary + NAPI module available)
     *   2. Wasm
     *
     * Supported backends: Wasm, NativeSharedMem
     * Not supported: WasmWorker (no workers in sync), NativeUnixSocket (async only)
     */
    static new(options?: BackendOptions): Promise<BarretenbergSync>;
    /**
     * Initialize the singleton instance.
     * @param options Backend configuration options
     */
    static initSingleton(options?: BackendOptions): Promise<BarretenbergSync>;
    static destroySingleton(): void;
    static getSingleton(): BarretenbergSync;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUN4RixPQUFPLEVBQUUsY0FBYyxFQUFlLE1BQU0seUJBQXlCLENBQUM7QUFHdEUsT0FBTyxFQUNMLGdCQUFnQixFQUNoQix3QkFBd0IsRUFDeEIsa0JBQWtCLEVBQ2xCLGFBQWEsRUFDYixlQUFlLEVBQ2YsS0FBSyx1QkFBdUIsRUFDNUIsS0FBSyxjQUFjLEdBQ3BCLE1BQU0sY0FBYyxDQUFDO0FBQ3RCLGNBQWMseUJBQXlCLENBQUM7QUFFeEMsTUFBTSxNQUFNLGNBQWMsR0FBRztJQUMzQiw0REFBNEQ7SUFDNUQsU0FBUyxFQUFFLE9BQU8sQ0FBQztDQUNwQixDQUFDO0FBRUY7OztHQUdHO0FBQ0gscUJBQWEsWUFBYSxTQUFRLFFBQVE7SUFDeEMsT0FBTyxDQUFDLE9BQU8sQ0FBaUI7SUFFaEMsWUFBWSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFHakU7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsT0FBYSxHQUFHLENBQUMsT0FBTyxHQUFFLGNBQW1CLHlCQTJCNUM7SUFFSyxZQUFZLENBQUMsT0FBTyxTQUEyQixHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FTcEU7SUFFRCxpQkFBaUIsSUFBSSxNQUFNLENBUTFCO0lBRUssbUJBQW1CLENBQ3ZCLFFBQVEsRUFBRSxVQUFVLEVBQ3BCLFNBQVMsRUFBRSxPQUFPLEVBQ2xCLGFBQWEsRUFBRSxPQUFPLEdBQ3JCLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQVkzQjtJQUVLLE9BQU8sa0JBRVo7SUFFRDs7O09BR0c7SUFDSCxPQUFhLGFBQWEsQ0FBQyxPQUFPLEdBQUUsY0FBbUIseUJBYXREO0lBRUQsT0FBYSxnQkFBZ0Isa0JBTTVCO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLFlBQVksaUJBS2xCO0NBQ0Y7QUFRRCxxQkFBYSxnQkFBaUIsU0FBUSxPQUFPO0lBQzNDLFlBQVksT0FBTyxFQUFFLG1CQUFtQixFQUV2QztJQUVEOzs7Ozs7Ozs7O09BVUc7SUFDSCxPQUFhLEdBQUcsQ0FBQyxPQUFPLEdBQUUsY0FBbUIsNkJBZTVDO0lBRUQ7OztPQUdHO0lBQ0gsT0FBYSxhQUFhLENBQUMsT0FBTyxHQUFFLGNBQW1CLDZCQU90RDtJQUVELE1BQU0sQ0FBQyxnQkFBZ0IsU0FNdEI7SUFFRCxNQUFNLENBQUMsWUFBWSxxQkFLbEI7Q0FDRiJ9