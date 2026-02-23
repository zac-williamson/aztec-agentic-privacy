import { Remote } from 'comlink';
import { BarretenbergWasmBase } from '../barretenberg_wasm_base/index.js';
export declare class BarretenbergWasmThread extends BarretenbergWasmBase {
    /**
     * Init as worker thread.
     * @param useCustomLogger - If true, logs will be posted back to main thread for custom logger routing
     */
    initThread(module: WebAssembly.Module, memory: WebAssembly.Memory, useCustomLogger?: boolean): Promise<void>;
    destroy(): void;
    protected getImportObj(memory: WebAssembly.Memory): {
        wasi_snapshot_preview1: {
            random_get: (out: any, length: number) => void;
            clock_time_get: (a1: number, a2: number, out: number) => void;
            proc_exit: () => never;
        };
        wasi: {
            'thread-spawn': () => never;
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
}
export type BarretenbergWasmThreadWorker = Remote<BarretenbergWasmThread>;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmdfd2FzbS9iYXJyZXRlbmJlcmdfd2FzbV90aHJlYWQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUVqQyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUUxRSxxQkFBYSxzQkFBdUIsU0FBUSxvQkFBb0I7SUFDOUQ7OztPQUdHO0lBQ1UsVUFBVSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLGVBQWUsVUFBUSxpQkFJdEc7SUFFTSxPQUFPLFNBRWI7SUFFRCxTQUFTLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTTs7Ozs7Ozs7Ozs7Ozs7Ozs7TUF5QmhEO0NBQ0Y7QUFFRCxNQUFNLE1BQU0sNEJBQTRCLEdBQUcsTUFBTSxDQUFDLHNCQUFzQixDQUFDLENBQUMifQ==