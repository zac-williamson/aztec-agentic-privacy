/**
 * Keeps track of heap allocations so they can be easily freed.
 * The WASM memory layout has 1024 bytes of unused "scratch" space at the start (addresses 0-1023).
 * We can leverage this for IO rather than making expensive bb_malloc bb_free calls.
 * Heap allocations will be created for input/output args that don't fit into the scratch space.
 * Input scratch grows UP from 0, output scratch grows DOWN from 1024, meeting in the middle.
 * This maximizes space utilization while preventing overlap.
 */
export class HeapAllocator {
    wasm;
    allocs = [];
    inScratchPtr = 0; // Next input starts here, grows UP
    outScratchPtr = 1024; // Next output ends here, grows DOWN
    constructor(wasm) {
        this.wasm = wasm;
    }
    getInputs(buffers) {
        return buffers.map(bufOrNum => {
            if (typeof bufOrNum === 'object') {
                const size = bufOrNum.length;
                // Check if there's room in scratch space (inputs grow up, outputs grow down)
                if (this.inScratchPtr + size <= this.outScratchPtr) {
                    const ptr = this.inScratchPtr;
                    this.inScratchPtr += size; // Grow UP
                    this.wasm.writeMemory(ptr, bufOrNum);
                    return ptr;
                }
                else {
                    // Fall back to heap allocation
                    const ptr = this.wasm.call('bbmalloc', size);
                    this.wasm.writeMemory(ptr, bufOrNum);
                    this.allocs.push(ptr);
                    return ptr;
                }
            }
            else {
                return bufOrNum;
            }
        });
    }
    getOutputPtrs(outLens) {
        return outLens.map(len => {
            // If the obj is variable length, we need a 4 byte ptr to write the serialized data address to.
            // WARNING: 4 only works with WASM as it has 32 bit memory.
            const size = len || 4;
            // Check if there's room in scratch space (inputs grow up, outputs grow down)
            if (this.inScratchPtr + size <= this.outScratchPtr) {
                this.outScratchPtr -= size; // Grow DOWN
                return this.outScratchPtr;
            }
            else {
                // Fall back to heap allocation
                const ptr = this.wasm.call('bbmalloc', size);
                this.allocs.push(ptr);
                return ptr;
            }
        });
    }
    addOutputPtr(ptr) {
        // Only add to dealloc list if it's a heap allocation (not in scratch space 0-1023)
        if (ptr >= 1024) {
            this.allocs.push(ptr);
        }
    }
    freeAll() {
        for (const ptr of this.allocs) {
            this.wasm.call('bbfree', ptr);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVhcF9hbGxvY2F0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYmFycmV0ZW5iZXJnX3dhc20vYmFycmV0ZW5iZXJnX3dhc21fbWFpbi9oZWFwX2FsbG9jYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQTs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFLSixJQUFJO0lBSmhCLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDdEIsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDLG1DQUFtQztJQUNyRCxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsb0NBQW9DO0lBRWxFLFlBQW9CLElBQTBCLEVBQUU7b0JBQTVCLElBQUk7SUFBeUIsQ0FBQztJQUVsRCxTQUFTLENBQUMsT0FBZ0MsRUFBRTtRQUMxQyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUM3QixJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUNqQyxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDO2dCQUM3Qiw2RUFBNkU7Z0JBQzdFLElBQUksSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUNuRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO29CQUM5QixJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxDQUFDLFVBQVU7b0JBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDckMsT0FBTyxHQUFHLENBQUM7Z0JBQ2IsQ0FBQztxQkFBTSxDQUFDO29CQUNOLCtCQUErQjtvQkFDL0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ3JDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QixPQUFPLEdBQUcsQ0FBQztnQkFDYixDQUFDO1lBQ0gsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE9BQU8sUUFBUSxDQUFDO1lBQ2xCLENBQUM7UUFBQSxDQUNGLENBQUMsQ0FBQztJQUFBLENBQ0o7SUFFRCxhQUFhLENBQUMsT0FBK0IsRUFBRTtRQUM3QyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN4QiwrRkFBK0Y7WUFDL0YsMkRBQTJEO1lBQzNELE1BQU0sSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFFdEIsNkVBQTZFO1lBQzdFLElBQUksSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNuRCxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxDQUFDLFlBQVk7Z0JBQ3hDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUM1QixDQUFDO2lCQUFNLENBQUM7Z0JBQ04sK0JBQStCO2dCQUMvQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzdDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QixPQUFPLEdBQUcsQ0FBQztZQUNiLENBQUM7UUFBQSxDQUNGLENBQUMsQ0FBQztJQUFBLENBQ0o7SUFFRCxZQUFZLENBQUMsR0FBVyxFQUFFO1FBQ3hCLG1GQUFtRjtRQUNuRixJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4QixDQUFDO0lBQUEsQ0FDRjtJQUVELE9BQU8sR0FBRztRQUNSLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNoQyxDQUFDO0lBQUEsQ0FDRjtDQUNGIn0=