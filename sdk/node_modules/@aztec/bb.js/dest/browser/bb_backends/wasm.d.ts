import { IMsgpackBackendSync, IMsgpackBackendAsync } from './interface.js';
/**
 * Synchronous WASM backend that wraps BarretenbergWasmMain.
 * Encapsulates all WASM initialization and memory management.
 */
export declare class BarretenbergWasmSyncBackend implements IMsgpackBackendSync {
    private wasm;
    private constructor();
    /**
     * Create and initialize a synchronous WASM backend.
     * @param wasmPath Optional path to WASM files
     * @param logger Optional logging function
     */
    static new(wasmPath?: string, logger?: (msg: string) => void): Promise<BarretenbergWasmSyncBackend>;
    call(inputBuffer: Uint8Array): Uint8Array;
    destroy(): void;
}
/**
 * Asynchronous WASM backend that supports both direct WASM and worker-based modes.
 *
 * Worker mode (default): Runs WASM on a worker thread to avoid blocking the main thread. Used in browsers.
 * Direct mode: Runs WASM directly on the calling thread. Used by node.js for better performance.
 */
export declare class BarretenbergWasmAsyncBackend implements IMsgpackBackendAsync {
    private wasm;
    private worker?;
    private constructor();
    /**
     * Create and initialize an asynchronous WASM backend.
     * @param options.threads Number of threads (defaults to hardware max, up to 32 for parallel proving)
     * @param options.wasmPath Optional path to WASM files
     * @param options.logger Optional logging function
     * @param options.memory Optional initial and maximum memory configuration
     * @param options.useWorker Run on worker thread (default: true for browser safety)
     */
    static new(options?: {
        threads?: number;
        wasmPath?: string;
        logger?: (msg: string) => void;
        memory?: {
            initial?: number;
            maximum?: number;
        };
        useWorker?: boolean;
    }): Promise<BarretenbergWasmAsyncBackend>;
    call(inputBuffer: Uint8Array): Promise<Uint8Array>;
    destroy(): Promise<void>;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FzbS5kLnRzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JiX2JhY2tlbmRzL3dhc20udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLG1CQUFtQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFLM0U7OztHQUdHO0FBQ0gscUJBQWEsMkJBQTRCLFlBQVcsbUJBQW1CO0lBQ2pELE9BQU8sQ0FBQyxJQUFJO0lBQWhDLE9BQU8sZUFBbUQ7SUFFMUQ7Ozs7T0FJRztJQUNILE9BQWEsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUssSUFBSSxHQUFHLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxDQUt4RztJQUVELElBQUksQ0FBQyxXQUFXLEVBQUUsVUFBVSxHQUFHLFVBQVUsQ0FFeEM7SUFFRCxPQUFPLElBQUksSUFBSSxDQUlkO0NBQ0Y7QUFFRDs7Ozs7R0FLRztBQUNILHFCQUFhLDRCQUE2QixZQUFXLG9CQUFvQjtJQUVyRSxPQUFPLENBQUMsSUFBSTtJQUNaLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFGakIsT0FBTyxlQUdIO0lBRUo7Ozs7Ozs7T0FPRztJQUNILE9BQWEsR0FBRyxDQUNkLE9BQU8sR0FBRTtRQUNQLE9BQU8sQ0FBQyxFQUFFLE1BQU0sQ0FBQztRQUNqQixRQUFRLENBQUMsRUFBRSxNQUFNLENBQUM7UUFDbEIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxLQUFLLElBQUksQ0FBQztRQUMvQixNQUFNLENBQUMsRUFBRTtZQUFFLE9BQU8sQ0FBQyxFQUFFLE1BQU0sQ0FBQztZQUFDLE9BQU8sQ0FBQyxFQUFFLE1BQU0sQ0FBQTtTQUFFLENBQUM7UUFDaEQsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDO0tBQ2hCLEdBQ0wsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBd0J2QztJQUVLLElBQUksQ0FBQyxXQUFXLEVBQUUsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FFdkQ7SUFFSyxPQUFPLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUs3QjtDQUNGIn0=