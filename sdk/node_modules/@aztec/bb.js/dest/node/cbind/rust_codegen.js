/**
 * Rust Code Generator - String template based
 *
 * Philosophy:
 *   - String templates for file structure
 *   - Simple type mapping
 *   - Idiomatic Rust conventions
 *   - No complex abstraction
 */
import { toSnakeCase, toPascalCase } from './naming.js';
export class RustCodegen {
    // Type mapping: Schema type -> Rust type
    mapType(type) {
        switch (type.kind) {
            case 'primitive':
                switch (type.primitive) {
                    case 'bool': return 'bool';
                    case 'u8': return 'u8';
                    case 'u16': return 'u16';
                    case 'u32': return 'u32';
                    case 'u64': return 'u64';
                    case 'f64': return 'f64';
                    case 'string': return 'String';
                    case 'bytes': return 'Vec<u8>';
                    case 'field2': return '[Vec<u8>; 2]'; // Extension field (Fq2) - pair of 32-byte field elements
                }
                break;
            case 'vector':
                return `Vec<${this.mapType(type.element)}>`;
            case 'array':
                const elemType = this.mapType(type.element);
                // Large arrays become Vec for ergonomics
                return type.size > 32 ? `Vec<${elemType}>` : `[${elemType}; ${type.size}]`;
            case 'optional':
                return `Option<${this.mapType(type.element)}>`;
            case 'struct':
                // Convert struct names to PascalCase for Rust conventions
                return toPascalCase(type.struct.name);
        }
        return 'Unknown';
    }
    // Check if field needs serde(with = "serde_bytes")
    needsSerdeBytes(type) {
        return type.kind === 'primitive' && type.primitive === 'bytes';
    }
    // Check if field needs serde(with = "serde_vec_bytes")
    needsSerdeVecBytes(type) {
        return type.kind === 'vector' && this.needsSerdeBytes(type.element);
    }
    // Check if field needs serde(with = "serde_array4_bytes") - for [Vec<u8>; 4] (Poseidon2 state)
    needsSerdeArray4Bytes(type) {
        return type.kind === 'array' && type.size === 4 && this.needsSerdeBytes(type.element);
    }
    // Generate struct field
    generateField(field) {
        const rustName = toSnakeCase(field.name);
        const rustType = this.mapType(field.type);
        let attrs = '';
        // Add serde rename if needed
        if (field.name !== rustName) {
            attrs += `    #[serde(rename = "${field.name}")]\n`;
        }
        // Add serde bytes handling
        if (this.needsSerdeArray4Bytes(field.type)) {
            attrs += `    #[serde(with = "serde_array4_bytes")]\n`;
        }
        else if (this.needsSerdeVecBytes(field.type)) {
            attrs += `    #[serde(with = "serde_vec_bytes")]\n`;
        }
        else if (this.needsSerdeBytes(field.type)) {
            attrs += `    #[serde(with = "serde_bytes")]\n`;
        }
        return `${attrs}    pub ${rustName}: ${rustType},`;
    }
    // Generate a struct definition
    generateStruct(struct, isCommand) {
        const rustName = toPascalCase(struct.name);
        const fields = struct.fields.map(f => this.generateField(f)).join('\n');
        // Add serde rename if struct name changed
        const serdeRename = struct.name !== rustName
            ? `\n#[serde(rename = "${struct.name}")]`
            : '';
        // Commands need __typename field for struct identification, but skip it during serialization
        const typenameField = isCommand
            ? `    #[serde(rename = "__typename", skip_serializing)]\n    pub type_name: String,\n`
            : '';
        // Generate constructor for commands
        const constructor = isCommand ? this.generateConstructor(struct, rustName) : '';
        return `/// ${struct.name}
#[derive(Debug, Clone, Serialize, Deserialize)]${serdeRename}
pub struct ${rustName} {
${typenameField}${fields}
}${constructor}`;
    }
    // Generate constructor for command structs
    generateConstructor(struct, rustName) {
        const params = struct.fields.map(f => `${toSnakeCase(f.name)}: ${this.mapType(f.type)}`).join(', ');
        const fieldInits = [
            `            type_name: "${struct.name}".to_string(),`,
            ...struct.fields.map(f => `            ${toSnakeCase(f.name)},`),
        ].join('\n');
        return `

impl ${rustName} {
    pub fn new(${params}) -> Self {
        Self {
${fieldInits}
        }
    }
}`;
    }
    // Generate Command enum
    generateCommandEnum(schema) {
        const names = Array.from(schema.structs.keys());
        const variants = names
            .map(name => {
            const rustName = toPascalCase(name);
            return `    ${rustName}(${rustName}),`;
        })
            .join('\n');
        const serializeCases = names
            .map(name => {
            const rustName = toPascalCase(name);
            return `            Command::${rustName}(data) => {
                tuple.serialize_element("${name}")?;
                tuple.serialize_element(data)?;
            }`;
        })
            .join('\n');
        const deserializeCases = names
            .map(name => {
            const rustName = toPascalCase(name);
            return `                    "${name}" => {
                        let data = seq.next_element()?
                            .ok_or_else(|| serde::de::Error::invalid_length(1, &self))?;
                        Ok(Command::${rustName}(data))
                    }`;
        })
            .join('\n');
        const variantNames = names
            .map(name => `"${name}"`)
            .join(', ');
        return `/// Command enum - wraps all possible commands
#[derive(Debug, Clone)]
pub enum Command {
${variants}
}

impl Serialize for Command {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        use serde::ser::SerializeTuple;
        let mut tuple = serializer.serialize_tuple(2)?;
        match self {
${serializeCases}
        }
        tuple.end()
    }
}

impl<'de> Deserialize<'de> for Command {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where D: serde::Deserializer<'de> {
        use serde::de::{SeqAccess, Visitor};
        struct CommandVisitor;

        impl<'de> Visitor<'de> for CommandVisitor {
            type Value = Command;
            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a 2-element array [name, payload]")
            }
            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where A: SeqAccess<'de> {
                let name: String = seq.next_element()?
                    .ok_or_else(|| serde::de::Error::invalid_length(0, &self))?;
                match name.as_str() {
${deserializeCases}
                    _ => Err(serde::de::Error::unknown_variant(&name, &[${variantNames}])),
                }
            }
        }
        deserializer.deserialize_tuple(2, CommandVisitor)
    }
}`;
    }
    // Generate Response enum
    generateResponseEnum(schema) {
        // Include all response types from commands plus ErrorResponse if it exists
        const commandResponseTypes = Array.from(new Set(schema.commands.map(c => c.responseType)));
        const responseTypes = schema.responses.has('ErrorResponse')
            ? [...commandResponseTypes, 'ErrorResponse']
            : commandResponseTypes;
        const variants = responseTypes
            .map(name => {
            const rustName = toPascalCase(name);
            return `    ${rustName}(${rustName}),`;
        })
            .join('\n');
        const serializeCases = responseTypes
            .map(name => {
            const rustName = toPascalCase(name);
            return `            Response::${rustName}(data) => {
                tuple.serialize_element("${name}")?;
                tuple.serialize_element(data)?;
            }`;
        })
            .join('\n');
        const deserializeCases = responseTypes
            .map(name => {
            const rustName = toPascalCase(name);
            return `                    "${name}" => {
                        let data = seq.next_element()?
                            .ok_or_else(|| serde::de::Error::invalid_length(1, &self))?;
                        Ok(Response::${rustName}(data))
                    }`;
        })
            .join('\n');
        const variantNames = responseTypes.map(name => `"${name}"`).join(', ');
        return `/// Response enum - wraps all possible responses
#[derive(Debug, Clone)]
pub enum Response {
${variants}
}

impl Serialize for Response {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        use serde::ser::SerializeTuple;
        let mut tuple = serializer.serialize_tuple(2)?;
        match self {
${serializeCases}
        }
        tuple.end()
    }
}

impl<'de> Deserialize<'de> for Response {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where D: serde::Deserializer<'de> {
        use serde::de::{SeqAccess, Visitor};
        struct ResponseVisitor;

        impl<'de> Visitor<'de> for ResponseVisitor {
            type Value = Response;
            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a 2-element array [name, payload]")
            }
            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where A: SeqAccess<'de> {
                let name: String = seq.next_element()?
                    .ok_or_else(|| serde::de::Error::invalid_length(0, &self))?;
                match name.as_str() {
${deserializeCases}
                    _ => Err(serde::de::Error::unknown_variant(&name, &[${variantNames}])),
                }
            }
        }
        deserializer.deserialize_tuple(2, ResponseVisitor)
    }
}`;
    }
    // Generate serde helper modules
    generateSerdeHelpers() {
        return `mod serde_bytes {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where S: Serializer { serializer.serialize_bytes(bytes) }
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where D: Deserializer<'de> { <Vec<u8>>::deserialize(deserializer) }
}

mod serde_vec_bytes {
    use serde::{Deserialize, Deserializer, Serializer, Serialize};
    use serde::ser::SerializeSeq;
    use serde::de::{SeqAccess, Visitor};

    #[derive(Serialize, Deserialize)]
    struct BytesWrapper(#[serde(with = "super::serde_bytes")] Vec<u8>);

    pub fn serialize<S>(vec: &Vec<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error>
    where S: Serializer {
        let mut seq = serializer.serialize_seq(Some(vec.len()))?;
        for bytes in vec {
            seq.serialize_element(&BytesWrapper(bytes.clone()))?;
        }
        seq.end()
    }
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<Vec<u8>>, D::Error>
    where D: Deserializer<'de> {
        struct VecVecU8Visitor;
        impl<'de> Visitor<'de> for VecVecU8Visitor {
            type Value = Vec<Vec<u8>>;
            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a sequence of byte arrays")
            }
            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where A: SeqAccess<'de> {
                let mut vec = Vec::new();
                while let Some(wrapper) = seq.next_element::<BytesWrapper>()? {
                    vec.push(wrapper.0);
                }
                Ok(vec)
            }
        }
        deserializer.deserialize_seq(VecVecU8Visitor)
    }
}

mod serde_array4_bytes {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use serde::ser::SerializeTuple;
    use serde::de::{SeqAccess, Visitor};

    #[derive(Serialize, Deserialize)]
    struct BytesWrapper(#[serde(with = "super::serde_bytes")] Vec<u8>);

    pub fn serialize<S>(arr: &[Vec<u8>; 4], serializer: S) -> Result<S::Ok, S::Error>
    where S: Serializer {
        let mut tup = serializer.serialize_tuple(4)?;
        for bytes in arr {
            tup.serialize_element(&BytesWrapper(bytes.clone()))?;
        }
        tup.end()
    }
    pub fn deserialize<'de, D>(deserializer: D) -> Result<[Vec<u8>; 4], D::Error>
    where D: Deserializer<'de> {
        struct Array4Visitor;
        impl<'de> Visitor<'de> for Array4Visitor {
            type Value = [Vec<u8>; 4];
            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("an array of 4 byte arrays")
            }
            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where A: SeqAccess<'de> {
                let mut arr: [Vec<u8>; 4] = Default::default();
                for (i, item) in arr.iter_mut().enumerate() {
                    *item = seq.next_element::<BytesWrapper>()?
                        .ok_or_else(|| serde::de::Error::invalid_length(i, &self))?.0;
                }
                Ok(arr)
            }
        }
        deserializer.deserialize_tuple(4, Array4Visitor)
    }
}`;
    }
    // Generate types file
    generateTypes(schema) {
        // Create set of top-level command struct names (only these need __typename)
        const commandNames = new Set(schema.commands.map(c => c.name));
        // Generate all structs (commands first, then responses)
        const commandStructs = Array.from(schema.structs.values())
            .map(s => this.generateStruct(s, commandNames.has(s.name)))
            .join('\n\n');
        const responseStructs = Array.from(schema.responses.values())
            .map(s => this.generateStruct(s, false))
            .join('\n\n');
        return `//! AUTOGENERATED - DO NOT EDIT
//! Generated from Barretenberg msgpack schema

use serde::{Deserialize, Serialize};

${this.generateSerdeHelpers()}

${commandStructs}

${responseStructs}

${this.generateCommandEnum(schema)}

${this.generateResponseEnum(schema)}
`;
    }
    // Generate API method
    generateApiMethod(command) {
        const methodName = toSnakeCase(command.name);
        const cmdRustName = toPascalCase(command.name);
        const respRustName = toPascalCase(command.responseType);
        const params = command.fields.map(f => {
            const rustType = this.mapType(f.type);
            // Only convert simple Vec<u8> to &[u8], not nested types
            const apiType = rustType === 'Vec<u8>' ? '&[u8]' : rustType;
            return `${toSnakeCase(f.name)}: ${apiType}`;
        }).join(', ');
        const paramConversions = command.fields.map(f => {
            const name = toSnakeCase(f.name);
            const rustType = this.mapType(f.type);
            // Only convert slices back to Vec
            if (rustType === 'Vec<u8>') {
                return `${name}.to_vec()`;
            }
            return name;
        }).join(', ');
        return `    /// Execute ${command.name} command
    pub fn ${methodName}(&mut self, ${params}) -> Result<${respRustName}> {
        let cmd = Command::${cmdRustName}(${cmdRustName}::new(${paramConversions}));
        match self.execute(cmd)? {
            Response::${respRustName}(resp) => Ok(resp),
            Response::ErrorResponse(err) => Err(BarretenbergError::Backend(
                err.message
            )),
            _ => Err(BarretenbergError::InvalidResponse(
                "Expected ${command.responseType}".to_string()
            )),
        }
    }`;
    }
    // Generate API file
    generateApi(schema) {
        const apiMethods = schema.commands
            .filter(c => c.name !== 'Shutdown')
            .map(c => this.generateApiMethod(c))
            .join('\n\n');
        return `//! AUTOGENERATED - DO NOT EDIT
//! High-level Barretenberg API - msgpack details hidden

use crate::backend::Backend;
use crate::error::{BarretenbergError, Result};
use crate::generated_types::*;

/// High-level Barretenberg API
pub struct BarretenbergApi<B: Backend> {
    backend: B,
}

impl<B: Backend> BarretenbergApi<B> {
    /// Create API with custom backend
    pub fn new(backend: B) -> Self {
        Self { backend }
    }

    fn execute(&mut self, command: Command) -> Result<Response> {
        let input_buffer = rmp_serde::to_vec_named(&vec![command])
            .map_err(|e| BarretenbergError::Serialization(e.to_string()))?;

        let output_buffer = self.backend.call(&input_buffer)?;

        let response: Response = rmp_serde::from_slice(&output_buffer)
            .map_err(|e| BarretenbergError::Deserialization(e.to_string()))?;

        Ok(response)
    }

${apiMethods}

    /// Shutdown backend gracefully
    pub fn shutdown(&mut self) -> Result<()> {
        let cmd = Command::Shutdown(Shutdown::new());
        let _ = self.execute(cmd)?;
        self.backend.destroy()
    }

    /// Destroy backend without shutdown command
    pub fn destroy(&mut self) -> Result<()> {
        self.backend.destroy()
    }
}
`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVzdF9jb2RlZ2VuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NiaW5kL3J1c3RfY29kZWdlbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7R0FRRztBQUdILE9BQU8sRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRXhELE1BQU0sT0FBTyxXQUFXO0lBQ3RCLHlDQUF5QztJQUNqQyxPQUFPLENBQUMsSUFBVSxFQUFVO1FBQ2xDLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2xCLEtBQUssV0FBVztnQkFDZCxRQUFRLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDdkIsS0FBSyxNQUFNLEVBQUUsT0FBTyxNQUFNLENBQUM7b0JBQzNCLEtBQUssSUFBSSxFQUFFLE9BQU8sSUFBSSxDQUFDO29CQUN2QixLQUFLLEtBQUssRUFBRSxPQUFPLEtBQUssQ0FBQztvQkFDekIsS0FBSyxLQUFLLEVBQUUsT0FBTyxLQUFLLENBQUM7b0JBQ3pCLEtBQUssS0FBSyxFQUFFLE9BQU8sS0FBSyxDQUFDO29CQUN6QixLQUFLLEtBQUssRUFBRSxPQUFPLEtBQUssQ0FBQztvQkFDekIsS0FBSyxRQUFRLEVBQUUsT0FBTyxRQUFRLENBQUM7b0JBQy9CLEtBQUssT0FBTyxFQUFFLE9BQU8sU0FBUyxDQUFDO29CQUMvQixLQUFLLFFBQVEsRUFBRSxPQUFPLGNBQWMsQ0FBQyxDQUFFLHlEQUF5RDtnQkFDbEcsQ0FBQztnQkFDRCxNQUFNO1lBRVIsS0FBSyxRQUFRO2dCQUNYLE9BQU8sT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFRLENBQUMsR0FBRyxDQUFDO1lBRS9DLEtBQUssT0FBTztnQkFDVixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFRLENBQUMsQ0FBQztnQkFDN0MseUNBQXlDO2dCQUN6QyxPQUFPLElB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