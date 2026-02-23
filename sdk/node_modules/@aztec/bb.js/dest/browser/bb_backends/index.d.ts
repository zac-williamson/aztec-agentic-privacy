/**
 * Backend types for Barretenberg
 */
export declare enum BackendType {
    /** WASM direct execution (no worker) */
    Wasm = "Wasm",
    /** WASM with worker threads */
    WasmWorker = "WasmWorker",
    /** Native via Unix domain socket (async only) */
    NativeUnixSocket = "NativeUnixSocket",
    /** Native via shared memory */
    NativeSharedMemory = "NativeSharedMemory"
}
export type BackendOptions = {
    /** @description Number of threads to run the backend worker on */
    threads?: number;
    /** @description Initial and Maximum memory to be alloted to the backend worker */
    memory?: {
        initial?: number;
        maximum?: number;
    };
    /** @description Path to download CRS files */
    crsPath?: string;
    /** @description Path to download WASM files */
    wasmPath?: string;
    /** @description Custom path to bb binary for native backend (overrides automatic detection) */
    bbPath?: string;
    /** @description Custom path to bb NAPI module for native backend (overrides automatic detection) */
    napiPath?: string;
    /**
     * @description Logging function
     * Warning: Attaching a logger can prevent nodejs from exiting without explicitly destroying the backend.
     */
    logger?: (msg: string) => void;
    /**
     * @description Maximum concurrent clients for shared memory IPC server (default: 1)
     * Only applies to NativeSharedMemory backend
     */
    maxClients?: number;
    /**
     * @description Specify exact backend to use
     * - If unset: tries backends in default order with fallback
     * - If set: must succeed with specified backend or throw error (no fallback)
     *
     * Barretenberg (async) supports: all types
     * BarretenbergSync supports: Wasm, NativeSharedMem only
     */
    backend?: BackendType;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iYl9iYWNrZW5kcy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7R0FFRztBQUNILG9CQUFZLFdBQVc7SUFDckIsd0NBQXdDO0lBQ3hDLElBQUksU0FBUztJQUNiLCtCQUErQjtJQUMvQixVQUFVLGVBQWU7SUFDekIsaURBQWlEO0lBQ2pELGdCQUFnQixxQkFBcUI7SUFDckMsK0JBQStCO0lBQy9CLGtCQUFrQix1QkFBdUI7Q0FDMUM7QUFFRCxNQUFNLE1BQU0sY0FBYyxHQUFHO0lBQzNCLGtFQUFrRTtJQUNsRSxPQUFPLENBQUMsRUFBRSxNQUFNLENBQUM7SUFFakIsa0ZBQWtGO0lBQ2xGLE1BQU0sQ0FBQyxFQUFFO1FBQUUsT0FBTyxDQUFDLEVBQUUsTUFBTSxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsTUFBTSxDQUFBO0tBQUUsQ0FBQztJQUVoRCw4Q0FBOEM7SUFDOUMsT0FBTyxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBRWpCLCtDQUErQztJQUMvQyxRQUFRLENBQUMsRUFBRSxNQUFNLENBQUM7SUFFbEIsK0ZBQStGO0lBQy9GLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUVoQixvR0FBb0c7SUFDcEcsUUFBUSxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBRWxCOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sS0FBSyxJQUFJLENBQUM7SUFFL0I7OztPQUdHO0lBQ0gsVUFBVSxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBRXBCOzs7Ozs7O09BT0c7SUFDSCxPQUFPLENBQUMsRUFBRSxXQUFXLENBQUM7Q0FDdkIsQ0FBQyJ9