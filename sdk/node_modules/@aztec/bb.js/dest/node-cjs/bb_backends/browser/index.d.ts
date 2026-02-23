import { Barretenberg, BarretenbergSync } from '../../barretenberg/index.js';
import { BackendOptions, BackendType } from '../index.js';
/**
 * Create backend of specific type (no fallback)
 */
export declare function createAsyncBackend(type: BackendType, options: BackendOptions, logger: (msg: string) => void): Promise<Barretenberg>;
/**
 * Create backend of specific type (no fallback)
 */
export declare function createSyncBackend(type: BackendType, options: BackendOptions, logger: (msg: string) => void): Promise<BarretenbergSync>;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iYl9iYWNrZW5kcy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUM3RSxPQUFPLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUUxRDs7R0FFRztBQUNILHdCQUFzQixrQkFBa0IsQ0FDdEMsSUFBSSxFQUFFLFdBQVcsRUFDakIsT0FBTyxFQUFFLGNBQWMsRUFDdkIsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sS0FBSyxJQUFJLEdBQzVCLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FtQnZCO0FBRUQ7O0dBRUc7QUFDSCx3QkFBc0IsaUJBQWlCLENBQ3JDLElBQUksRUFBRSxXQUFXLEVBQ2pCLE9BQU8sRUFBRSxjQUFjLEVBQ3ZCLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUssSUFBSSxHQUM1QixPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FVM0IifQ==