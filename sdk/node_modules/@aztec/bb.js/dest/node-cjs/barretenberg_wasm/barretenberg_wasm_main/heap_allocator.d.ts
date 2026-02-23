import { type BarretenbergWasmMain } from './index.js';
/**
 * Keeps track of heap allocations so they can be easily freed.
 * The WASM memory layout has 1024 bytes of unused "scratch" space at the start (addresses 0-1023).
 * We can leverage this for IO rather than making expensive bb_malloc bb_free calls.
 * Heap allocations will be created for input/output args that don't fit into the scratch space.
 * Input scratch grows UP from 0, output scratch grows DOWN from 1024, meeting in the middle.
 * This maximizes space utilization while preventing overlap.
 */
export declare class HeapAllocator {
    private wasm;
    private allocs;
    private inScratchPtr;
    private outScratchPtr;
    constructor(wasm: BarretenbergWasmMain);
    getInputs(buffers: (Uint8Array | number)[]): number[];
    getOutputPtrs(outLens: (number | undefined)[]): number[];
    addOutputPtr(ptr: number): void;
    freeAll(): void;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVhcF9hbGxvY2F0b3IuZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmdfd2FzbS9iYXJyZXRlbmJlcmdfd2FzbV9tYWluL2hlYXBfYWxsb2NhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxLQUFLLG9CQUFvQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXZEOzs7Ozs7O0dBT0c7QUFDSCxxQkFBYSxhQUFhO0lBS1osT0FBTyxDQUFDLElBQUk7SUFKeEIsT0FBTyxDQUFDLE1BQU0sQ0FBZ0I7SUFDOUIsT0FBTyxDQUFDLFlBQVksQ0FBSztJQUN6QixPQUFPLENBQUMsYUFBYSxDQUFRO0lBRTdCLFlBQW9CLElBQUksRUFBRSxvQkFBb0IsRUFBSTtJQUVsRCxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxFQUFFLFlBcUJ6QztJQUVELGFBQWEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLEVBQUUsWUFpQjVDO0lBRUQsWUFBWSxDQUFDLEdBQUcsRUFBRSxNQUFNLFFBS3ZCO0lBRUQsT0FBTyxTQUlOO0NBQ0YifQ==