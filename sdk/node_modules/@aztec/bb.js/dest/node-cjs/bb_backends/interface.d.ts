/**
 * Generic interface for msgpack backend implementations.
 * Both WASM and native binary backends implement this interface.
 */
export interface IMsgpackBackend {
    /**
     * Execute a msgpack command and return the msgpack response.
     * @param inputBuffer The msgpack-encoded input buffer
     * @returns The msgpack-encoded response buffer (sync or async)
     */
    call(inputBuffer: Uint8Array): Uint8Array | Promise<Uint8Array>;
    /**
     * Clean up resources.
     */
    destroy(): void | Promise<void>;
}
/**
 * Synchronous variant of IMsgpackBackend.
 * Used by BarretenbergSync and SyncApi.
 */
export interface IMsgpackBackendSync extends IMsgpackBackend {
    call(inputBuffer: Uint8Array): Uint8Array;
    destroy(): void;
}
/**
 * Asynchronous variant of IMsgpackBackend.
 * Used by Barretenberg and AsyncApi.
 */
export interface IMsgpackBackendAsync extends IMsgpackBackend {
    call(inputBuffer: Uint8Array): Promise<Uint8Array>;
    destroy(): Promise<void>;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJmYWNlLmQudHMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmJfYmFja2VuZHMvaW50ZXJmYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7R0FHRztBQUNILE1BQU0sV0FBVyxlQUFlO0lBQzlCOzs7O09BSUc7SUFDSCxJQUFJLENBQUMsV0FBVyxFQUFFLFVBQVUsR0FBRyxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRWhFOztPQUVHO0lBQ0gsT0FBTyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDakM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFdBQVcsbUJBQW9CLFNBQVEsZUFBZTtJQUMxRCxJQUFJLENBQUMsV0FBVyxFQUFFLFVBQVUsR0FBRyxVQUFVLENBQUM7SUFDMUMsT0FBTyxJQUFJLElBQUksQ0FBQztDQUNqQjtBQUVEOzs7R0FHRztBQUNILE1BQU0sV0FBVyxvQkFBcUIsU0FBUSxlQUFlO0lBQzNELElBQUksQ0FBQyxXQUFXLEVBQUUsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNuRCxPQUFPLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFCIn0=