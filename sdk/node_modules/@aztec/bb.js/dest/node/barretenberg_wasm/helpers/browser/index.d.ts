export declare function getSharedMemoryAvailable(): boolean;
export declare function getRemoteBarretenbergWasm<T>(worker: Worker): import("comlink").Remote<T>;
export declare function getNumCpu(): number;
export declare function threadLogger(useCustomLogger: boolean): ((msg: string) => void) | undefined;
export declare function killSelf(): void;
export declare function getAvailableThreads(logger: (msg: string) => void): number;
/** The message expected by the `readinessListener`. */
export declare const Ready: {
    ready: boolean;
};
/** Listen for the readiness message from the Worker and call the `callback` once. */
export declare function readinessListener(worker: Worker, callback: () => void): void;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9iYXJyZXRlbmJlcmdfd2FzbS9oZWxwZXJzL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsd0JBQWdCLHdCQUF3QixZQUd2QztBQUVELHdCQUFnQix5QkFBeUIsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sK0JBRTFEO0FBRUQsd0JBQWdCLFNBQVMsV0FFeEI7QUFFRCx3QkFBZ0IsWUFBWSxDQUFDLGVBQWUsRUFBRSxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsU0FBUyxDQVMxRjtBQUVELHdCQUFnQixRQUFRLFNBRXZCO0FBRUQsd0JBQWdCLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUssSUFBSSxHQUFHLE1BQU0sQ0FPekU7QUFLRCx1REFBdUQ7QUFDdkQsZUFBTyxNQUFNLEtBQUs7O0NBQWtCLENBQUM7QUFFckMscUZBQXFGO0FBQ3JGLHdCQUFnQixpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLElBQUksUUFPckUifQ==