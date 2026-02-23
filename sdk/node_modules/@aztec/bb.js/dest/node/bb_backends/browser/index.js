import { BarretenbergWasmSyncBackend, BarretenbergWasmAsyncBackend } from '../wasm.js';
import { Barretenberg, BarretenbergSync } from '../../barretenberg/index.js';
import { BackendType } from '../index.js';
/**
 * Create backend of specific type (no fallback)
 */
export async function createAsyncBackend(type, options, logger) {
    switch (type) {
        case BackendType.Wasm:
        case BackendType.WasmWorker: {
            const useWorker = type === BackendType.WasmWorker;
            logger(`Using WASM backend (worker: ${useWorker})`);
            const wasm = await BarretenbergWasmAsyncBackend.new({
                threads: options.threads,
                wasmPath: options.wasmPath,
                logger,
                memory: options.memory,
                useWorker,
            });
            return new Barretenberg(wasm, options);
        }
        default:
            throw new Error(`Unknown backend type: ${type}`);
    }
}
/**
 * Create backend of specific type (no fallback)
 */
export async function createSyncBackend(type, options, logger) {
    switch (type) {
        case BackendType.Wasm:
            logger('Using WASM backend');
            const wasm = await BarretenbergWasmSyncBackend.new(options.wasmPath, logger);
            return new BarretenbergSync(wasm);
        default:
            throw new Error(`Backend ${type} not supported for BarretenbergSync`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYmJfYmFja2VuZHMvYnJvd3Nlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDdkYsT0FBTyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzdFLE9BQU8sRUFBa0IsV0FBVyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRTFEOztHQUVHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSxrQkFBa0IsQ0FDdEMsSUFBaUIsRUFDakIsT0FBdUIsRUFDdkIsTUFBNkIsRUFDTjtJQUN2QixRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2IsS0FBSyxXQUFXLENBQUMsSUFBSSxDQUFDO1FBQ3RCLEtBQUssV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQzVCLE1BQU0sU0FBUyxHQUFHLElBQUksS0FBSyxXQUFXLENBQUMsVUFBVSxDQUFDO1lBQ2xELE1BQU0sQ0FBQywrQkFBK0IsU0FBUyxHQUFHLENBQUMsQ0FBQztZQUNwRCxNQUFNLElBQUksR0FBRyxNQUFNLDRCQUE0QixDQUFDLEdBQUcsQ0FBQztnQkFDbEQsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO2dCQUN4QixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7Z0JBQzFCLE1BQU07Z0JBQ04sTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO2dCQUN0QixTQUFTO2FBQ1YsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVEO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNyRCxDQUFDO0FBQUEsQ0FDRjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSxpQkFBaUIsQ0FDckMsSUFBaUIsRUFDakIsT0FBdUIsRUFDdkIsTUFBNkIsRUFDRjtJQUMzQixRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2IsS0FBSyxXQUFXLENBQUMsSUFBSTtZQUNuQixNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUM3QixNQUFNLElBQUksR0FBRyxNQUFNLDJCQUEyQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzdFLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwQztZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxJQUFJLHFDQUFxQyxDQUFDLENBQUM7SUFDMUUsQ0FBQztBQUFBLENBQ0YifQ==