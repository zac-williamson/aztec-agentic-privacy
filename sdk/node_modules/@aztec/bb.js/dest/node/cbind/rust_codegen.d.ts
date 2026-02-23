/**
 * Rust Code Generator - String template based
 *
 * Philosophy:
 *   - String templates for file structure
 *   - Simple type mapping
 *   - Idiomatic Rust conventions
 *   - No complex abstraction
 */
import type { CompiledSchema } from './schema_visitor.js';
export declare class RustCodegen {
    private mapType;
    private needsSerdeBytes;
    private needsSerdeVecBytes;
    private needsSerdeArray4Bytes;
    private generateField;
    private generateStruct;
    private generateConstructor;
    private generateCommandEnum;
    private generateResponseEnum;
    private generateSerdeHelpers;
    generateTypes(schema: CompiledSchema): string;
    private generateApiMethod;
    generateApi(schema: CompiledSchema): string;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVzdF9jb2RlZ2VuLmQudHMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY2JpbmQvcnVzdF9jb2RlZ2VuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7OztHQVFHO0FBRUgsT0FBTyxLQUFLLEVBQUUsY0FBYyxFQUF1QixNQUFNLHFCQUFxQixDQUFDO0FBRy9FLHFCQUFhLFdBQVc7SUFFdEIsT0FBTyxDQUFDLE9BQU87SUFvQ2YsT0FBTyxDQUFDLGVBQWU7SUFLdkIsT0FBTyxDQUFDLGtCQUFrQjtJQUsxQixPQUFPLENBQUMscUJBQXFCO0lBSzdCLE9BQU8sQ0FBQyxhQUFhO0lBdUJyQixPQUFPLENBQUMsY0FBYztJQXlCdEIsT0FBTyxDQUFDLG1CQUFtQjtJQXNCM0IsT0FBTyxDQUFDLG1CQUFtQjtJQStFM0IsT0FBTyxDQUFDLG9CQUFvQjtJQWlGNUIsT0FBTyxDQUFDLG9CQUFvQjtJQXNGNUIsYUFBYSxDQUFDLE1BQU0sRUFBRSxjQUFjLEdBQUcsTUFBTSxDQTRCNUM7SUFHRCxPQUFPLENBQUMsaUJBQWlCO0lBc0N6QixXQUFXLENBQUMsTUFBTSxFQUFFLGNBQWMsR0FBRyxNQUFNLENBbUQxQztDQUNGIn0=