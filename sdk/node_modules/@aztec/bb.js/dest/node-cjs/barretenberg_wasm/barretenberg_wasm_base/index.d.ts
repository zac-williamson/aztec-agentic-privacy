/**
 * Base implementation of BarretenbergWasm.
 * Contains code that is common to the "main thread" implementation and the "child thread" implementation.
 */
export declare class BarretenbergWasmBase {
    protected memStore: {
        [key: string]: Uint8Array;
    };
    protected memory: WebAssembly.Memory;
    protected instance: WebAssembly.Instance;
    protected logger: (msg: string) => void;
    protected getImportObj(memory: WebAssembly.Memory): {
        wasi_snapshot_preview1: {
            random_get: (out: any, length: number) => void;
            clock_time_get: (a1: number, a2: number, out: number) => void;
            proc_exit: () => never;
        };
        env: {
            /**
             * The 'info' call we use for logging in C++, calls this under the hood.
             * The native code will just print to std:err (to avoid std::cout which is used for IPC).
             * Here we just emit the log line for the client to decide what to do with.
             */
            logstr: (addr: number) => void;
            throw_or_abort_impl: (addr: number) => never;
            get_data: (keyAddr: number, outBufAddr: number) => void;
            set_data: (keyAddr: number, dataAddr: number, dataLength: number) => void;
            memory: WebAssembly.Memory;
        };
    };
    exports(): any;
    /**
     * When returning values from the WASM, use >>> operator to convert signed representation to unsigned representation.
     */
    call(name: string, ...args: any): number;
    memSize(): number;
    /**
     * Returns a copy of the data, not a view.
     */
    getMemorySlice(start: number, end: number): Uint8Array<ArrayBuffer>;
    writeMemory(offset: number, arr: Uint8Array): void;
    getMemory(): Uint8Array<ArrayBuffer>;
    private stringFromAddress;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmdfd2FzbS9iYXJyZXRlbmJlcmdfd2FzbV9iYXNlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBOzs7R0FHRztBQUNILHFCQUFhLG9CQUFvQjtJQUMvQixTQUFTLENBQUMsUUFBUSxFQUFFO1FBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxHQUFHLFVBQVUsQ0FBQTtLQUFFLENBQU07SUFDdkQsU0FBUyxDQUFDLE1BQU0sRUFBRyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBQ3RDLFNBQVMsQ0FBQyxRQUFRLEVBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztJQUMxQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sS0FBSyxJQUFJLENBQVk7SUFFbkQsU0FBUyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU07Ozs7Ozs7WUE0QjNDOzs7O2VBSUc7Ozs7Ozs7TUF1Q1I7SUFFTSxPQUFPLElBQUksR0FBRyxDQUVwQjtJQUVEOztPQUVHO0lBQ0ksSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsR0FBRyxVQVlyQztJQUVNLE9BQU8sV0FFYjtJQUVEOztPQUVHO0lBQ0ksY0FBYyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sMkJBRS9DO0lBRU0sV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFVBQVUsUUFHakQ7SUFFTSxTQUFTLDRCQUVmO0lBSUQsT0FBTyxDQUFDLGlCQUFpQjtDQVExQiJ9