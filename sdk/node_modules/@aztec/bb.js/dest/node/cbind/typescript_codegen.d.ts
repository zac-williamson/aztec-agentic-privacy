/**
 * TypeScript Code Generator - String template based
 *
 * Philosophy:
 *   - String templates for file structure
 *   - Simple type mapping
 *   - Idiomatic TypeScript conventions
 *   - No complex abstraction
 */
import type { CompiledSchema } from './schema_visitor.js';
export declare class TypeScriptCodegen {
    private mapType;
    private mapMsgpackType;
    private needsConversion;
    private generateField;
    private generateMsgpackField;
    private generateInterface;
    private generateMsgpackInterface;
    private generateToFunction;
    private generateFromFunction;
    private generateToConverter;
    private generateFromConverter;
    generateTypes(schema: CompiledSchema): string;
    private generateAsyncApiMethod;
    private generateSyncApiMethod;
    generateAsyncApi(schema: CompiledSchema): string;
    generateSyncApi(schema: CompiledSchema): string;
    private generateApiImports;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdF9jb2RlZ2VuLmQudHMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY2JpbmQvdHlwZXNjcmlwdF9jb2RlZ2VuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7OztHQVFHO0FBRUgsT0FBTyxLQUFLLEVBQUUsY0FBYyxFQUFnQyxNQUFNLHFCQUFxQixDQUFDO0FBUXhGLHFCQUFhLGlCQUFpQjtJQUU1QixPQUFPLENBQUMsT0FBTztJQWlDZixPQUFPLENBQUMsY0FBYztJQWlDdEIsT0FBTyxDQUFDLGVBQWU7SUFldkIsT0FBTyxDQUFDLGFBQWE7SUFPckIsT0FBTyxDQUFDLG9CQUFvQjtJQU01QixPQUFPLENBQUMsaUJBQWlCO0lBVXpCLE9BQU8sQ0FBQyx3QkFBd0I7SUFVaEMsT0FBTyxDQUFDLGtCQUFrQjtJQThCMUIsT0FBTyxDQUFDLG9CQUFvQjtJQWlDNUIsT0FBTyxDQUFDLG1CQUFtQjtJQXdCM0IsT0FBTyxDQUFDLHFCQUFxQjtJQXdCN0IsYUFBYSxDQUFDLE1BQU0sRUFBRSxjQUFjLEdBQUcsTUFBTSxDQWlENUM7SUFHRCxPQUFPLENBQUMsc0JBQXNCO0lBbUI5QixPQUFPLENBQUMscUJBQXFCO0lBbUI3QixnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsY0FBYyxHQUFHLE1BQU0sQ0E2Qi9DO0lBR0QsZUFBZSxDQUFDLE1BQU0sRUFBRSxjQUFjLEdBQUcsTUFBTSxDQTZCOUM7SUFHRCxPQUFPLENBQUMsa0JBQWtCO0NBbUIzQiJ9