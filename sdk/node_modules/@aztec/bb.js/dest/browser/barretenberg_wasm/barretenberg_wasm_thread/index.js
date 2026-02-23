import { killSelf, threadLogger } from '../helpers/index.js';
import { BarretenbergWasmBase } from '../barretenberg_wasm_base/index.js';
export class BarretenbergWasmThread extends BarretenbergWasmBase {
    /**
     * Init as worker thread.
     * @param useCustomLogger - If true, logs will be posted back to main thread for custom logger routing
     */
    async initThread(module, memory, useCustomLogger = false) {
        this.logger = threadLogger(useCustomLogger) || this.logger;
        this.memory = memory;
        this.instance = await WebAssembly.instantiate(module, this.getImportObj(this.memory));
    }
    destroy() {
        killSelf();
    }
    getImportObj(memory) {
        const baseImports = super.getImportObj(memory);
        /* eslint-disable camelcase */
        return {
            ...baseImports,
            wasi: {
                'thread-spawn': () => {
                    this.logger('PANIC: threads cannot spawn threads!');
                    this.logger(new Error().stack);
                    killSelf();
                },
            },
            // These are functions implementations for imports we've defined are needed.
            // The native C++ build defines these in a module called "env". We must implement TypeScript versions here.
            env: {
                ...baseImports.env,
                env_hardware_concurrency: () => {
                    // We return 1, which should cause any algos using threading to just not create a thread.
                    return 1;
                },
            },
        };
        /* eslint-enable camelcase */
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYmFycmV0ZW5iZXJnX3dhc20vYmFycmV0ZW5iZXJnX3dhc21fdGhyZWFkL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDN0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFMUUsTUFBTSxPQUFPLHNCQUF1QixTQUFRLG9CQUFvQjtJQUM5RDs7O09BR0c7SUFDSSxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQTBCLEVBQUUsTUFBMEIsRUFBRSxlQUFlLEdBQUcsS0FBSyxFQUFFO1FBQ3ZHLElBQUksQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDM0QsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFBQSxDQUN2RjtJQUVNLE9BQU8sR0FBRztRQUNmLFFBQVEsRUFBRSxDQUFDO0lBQUEsQ0FDWjtJQUVTLFlBQVksQ0FBQyxNQUEwQixFQUFFO1FBQ2pELE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFL0MsOEJBQThCO1FBQzlCLE9BQU87WUFDTCxHQUFHLFdBQVc7WUFDZCxJQUFJLEVBQUU7Z0JBQ0osY0FBYyxFQUFFLEdBQUcsRUFBRSxDQUFDO29CQUNwQixJQUFJLENBQUMsTUFBTSxDQUFDLHNDQUFzQyxDQUFDLENBQUM7b0JBQ3BELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxLQUFNLENBQUMsQ0FBQztvQkFDaEMsUUFBUSxFQUFFLENBQUM7Z0JBQUEsQ0FDWjthQUNGO1lBRUQsNEVBQTRFO1lBQzVFLDJHQUEyRztZQUMzRyxHQUFHLEVBQUU7Z0JBQ0gsR0FBRyxXQUFXLENBQUMsR0FBRztnQkFDbEIsd0JBQXdCLEVBQUUsR0FBRyxFQUFFLENBQUM7b0JBQzlCLHlGQUF5RjtvQkFDekYsT0FBTyxDQUFDLENBQUM7Z0JBQUEsQ0FDVjthQUNGO1NBQ0YsQ0FBQztRQUNGLDZCQUE2QjtJQUQzQixDQUVIO0NBQ0YifQ==