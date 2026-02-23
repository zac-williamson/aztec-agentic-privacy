export { BackendType };
/**
 * Backend types for Barretenberg
 */
var BackendType;
(function (BackendType) {
    /** WASM direct execution (no worker) */
    BackendType["Wasm"] = "Wasm";
    /** WASM with worker threads */
    BackendType["WasmWorker"] = "WasmWorker";
    /** Native via Unix domain socket (async only) */
    BackendType["NativeUnixSocket"] = "NativeUnixSocket";
    /** Native via shared memory */
    BackendType["NativeSharedMemory"] = "NativeSharedMemory";
})(BackendType || (BackendType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmJfYmFja2VuZHMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IlNBR1ksV0FBVztBQUh2Qjs7R0FFRztBQUNILElBQVksV0FTWDtBQVRELFdBQVksV0FBVztJQUNyQix3Q0FBd0M7SUFDeEMsNEJBQWEsQ0FBQTtJQUNiLCtCQUErQjtJQUMvQix3Q0FBeUIsQ0FBQTtJQUN6QixpREFBaUQ7SUFDakQsb0RBQXFDLENBQUE7SUFDckMsK0JBQStCO0lBQy9CLHdEQUF5QyxDQUFBO0FBQUMsQ0FDNUMsRUFUWSxXQUFXLEtBQVgsV0FBVyxRQVN0QiJ9