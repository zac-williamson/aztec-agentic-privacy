import { Remote } from 'comlink';
import { BarretenbergWasmBase } from '../barretenberg_wasm_base/index.js';
/**
 * This is the "main thread" implementation of BarretenbergWasm.
 * It spawns a bunch of "child thread" implementations.
 * In a browser context, this still runs on a worker, as it will block waiting on child threads.
 */
export declare class BarretenbergWasmMain extends BarretenbergWasmBase {
    static MAX_THREADS: number;
    private workers;
    private remoteWasms;
    private nextWorker;
    private nextThreadId;
    private useCustomLogger;
    private msgpackInputScratch;
    private msgpackOutputScratch;
    private readonly MSGPACK_SCRATCH_SIZE;
    getNumThreads(): number;
    /**
     * Init as main thread. Spawn child threads.
     */
    init(module: WebAssembly.Module, threads?: number, logger?: (msg: string) => void, initial?: number, maximum?: number): Promise<void>;
    private getDefaultMaximumMemoryPages;
    /**
     * Set up forwarding of log messages from worker threads to our logger.
     * Workers post messages with { type: 'log', msg: string } which we intercept here.
     */
    private setupWorkerLogForwarding;
    /**
     * Called on main thread. Signals child threads to gracefully exit.
     */
    destroy(): Promise<void>;
    protected getImportObj(memory: WebAssembly.Memory): {
        wasi_snapshot_preview1: {
            random_get: (out: any, length: number) => void;
            clock_time_get: (a1: number, a2: number, out: number) => void;
            proc_exit: () => never;
        };
        wasi: {
            'thread-spawn': (arg: number) => number;
        };
        env: {
            logstr: (addr: number) => void;
            throw_or_abort_impl: (addr: number) => never;
            get_data: (keyAddr: number, outBufAddr: number) => void;
            set_data: (keyAddr: number, dataAddr: number, dataLength: number) => void;
            memory: WebAssembly.Memory;
            env_hardware_concurrency: () => number;
        };
    };
    callWasmExport(funcName: string, inArgs: (Uint8Array | number)[], outLens: (number | undefined)[]): Uint8Array<ArrayBuffer>[];
    private getOutputArgs;
    cbindCall(cbind: string, inputBuffer: Uint8Array): any;
}
/**
 * The comlink type that asyncifies the BarretenbergWasmMain api.
 */
export type BarretenbergWasmMainWorker = Remote<BarretenbergWasmMain>;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmdfd2FzbS9iYXJyZXRlbmJlcmdfd2FzbV9tYWluL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFJakMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFHMUU7Ozs7R0FJRztBQUNILHFCQUFhLG9CQUFxQixTQUFRLG9CQUFvQjtJQUM1RCxNQUFNLENBQUMsV0FBVyxTQUFNO0lBQ3hCLE9BQU8sQ0FBQyxPQUFPLENBQWdCO0lBQy9CLE9BQU8sQ0FBQyxXQUFXLENBQXNDO0lBQ3pELE9BQU8sQ0FBQyxVQUFVLENBQUs7SUFDdkIsT0FBTyxDQUFDLFlBQVksQ0FBSztJQUN6QixPQUFPLENBQUMsZUFBZSxDQUFTO0lBR2hDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBYTtJQUN4QyxPQUFPLENBQUMsb0JBQW9CLENBQWE7SUFDekMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBbUI7SUFFakQsYUFBYSxXQUVuQjtJQUVEOztPQUVHO0lBQ1UsSUFBSSxDQUNmLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUMxQixPQUFPLFNBQTBELEVBQ2pFLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sS0FBSyxJQUFJLEVBQzlCLE9BQU8sU0FBSyxFQUNaLE9BQU8sU0FBc0MsaUJBOEM5QztJQUVELE9BQU8sQ0FBQyw0QkFBNEI7SUFVcEM7OztPQUdHO0lBQ0gsT0FBTyxDQUFDLHdCQUF3QjtJQXFCaEM7O09BRUc7SUFDVSxPQUFPLGtCQUVuQjtJQUVELFNBQVMsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNOzs7Ozs7Ozs7Ozs7Ozs7OztNQTJCaEQ7SUFFRCxjQUFjLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLEVBQUUsNkJBUWhHO0lBRUQsT0FBTyxDQUFDLGFBQWE7SUFtQnJCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxVQUFVLEdBQUcsR0FBRyxDQTJEckQ7Q0FDRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxNQUFNLDBCQUEwQixHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDIn0=