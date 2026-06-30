const _ = require('lodash');

/**
 * Validates Avro schema naming conventions
 * Rules:
 * - Record and enum names must be PascalCase
 * - Field names must be camelCase
 * - Enum constants must be SCREAMING_CAP_CASE (numeric constants can start with underscore)
 * - No non-alphanumeric characters in PascalCase or camelCase names
 * - Records/enums with same signature should have same name (deduplication check)
 */

const isPascalCase = name => {
	const pascalCaseRegex = /^[A-Z][A-Za-z0-9]*$/;
	return pascalCaseRegex.test(name);
};

const isCamelCase = name => {
	const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;
	return camelCaseRegex.test(name);
};

const isScreamingSnakeCase = name => {
	// Numeric constants can start with underscore
	const screamingCaseRegex = /^_?[A-Z0-9][A-Z0-9_]*$/;
	return screamingCaseRegex.test(name);
};

const hasNonAlphanumericChars = name => {
	const alphanumericRegex = /^[a-zA-Z0-9_]*$/;
	return !alphanumericRegex.test(name);
};

/**
 * Validates a single Avro schema
 * @param {Object} schema - The Avro schema to validate
 * @param {Object} context - Validation context (to track named types)
 * @returns {Array<string>} Array of error messages
 */
const validateSchema = (schema, context = {}) => {
	if (!schema || typeof schema !== 'object') {
		return [];
	}

	const errors = [];
	const namedTypes = context.namedTypes || {};

	if (schema.type === 'record') {
		errors.push(...validateRecord(schema, namedTypes));
	} else if (schema.type === 'enum') {
		errors.push(...validateEnum(schema, namedTypes));
	} else if (schema.type === 'fixed') {
		errors.push(...validateFixed(schema, namedTypes));
	} else if (Array.isArray(schema.type)) {
		// Handle union types
		for (const type of schema.type) {
			if (typeof type === 'object') {
				errors.push(...validateSchema(type, context));
			}
		}
	} else if (schema.type === 'array' && schema.items) {
		errors.push(...validateSchema(schema.items, context));
	} else if (schema.type === 'map' && schema.values) {
		errors.push(...validateSchema(schema.values, context));
	}

	// Validate fields
	if (schema.fields && Array.isArray(schema.fields)) {
		errors.push(...validateFields(schema.fields, context));
	}

	return errors;
};

/**
 * Validates record schema
 * @param {Object} schema - The record schema
 * @param {Object} namedTypes - Map of named types seen so far
 * @returns {Array<string>} Array of error messages
 */
const validateRecord = (schema, namedTypes = {}) => {
	const errors = [];
	const name = schema.name;

	if (!name) {
		errors.push('Record must have a name');
		return errors;
	}

	if (!isPascalCase(name)) {
		errors.push(`Record name "${name}" must be PascalCase`);
	}

	if (hasNonAlphanumericChars(name)) {
		errors.push(`Record name "${name}" contains non-alphanumeric characters (except underscore)`);
	}

	// Check for duplicate signatures
	const signature = getRecordSignature(schema);
	if (namedTypes[signature] && namedTypes[signature] !== name) {
		errors.push(
			`Records with the same structure must have the same name. ` +
				`Found names "${namedTypes[signature]}" and "${name}" for the same structure`,
		);
	} else {
		namedTypes[signature] = name;
	}

	return errors;
};

/**
 * Validates enum schema
 * @param {Object} schema - The enum schema
 * @param {Object} namedTypes - Map of named types seen so far
 * @returns {Array<string>} Array of error messages
 */
const validateEnum = (schema, namedTypes = {}) => {
	const errors = [];
	const name = schema.name;

	if (!name) {
		errors.push('Enum must have a name');
		return errors;
	}

	if (!isPascalCase(name)) {
		errors.push(`Enum name "${name}" must be PascalCase`);
	}

	if (hasNonAlphanumericChars(name)) {
		errors.push(`Enum name "${name}" contains non-alphanumeric characters (except underscore)`);
	}

	// Validate enum symbols (constants)
	if (schema.symbols && Array.isArray(schema.symbols)) {
		for (const symbol of schema.symbols) {
			if (!isScreamingSnakeCase(symbol)) {
				errors.push(`Enum symbol "${symbol}" must be SCREAMING_CASE (allow numeric start with underscore)`);
			}
		}
	}

	// Check for duplicate signatures
	const signature = getEnumSignature(schema);
	if (namedTypes[signature] && namedTypes[signature] !== name) {
		errors.push(
			`Enums with the same structure must have the same name. ` +
				`Found names "${namedTypes[signature]}" and "${name}" for the same structure`,
		);
	} else {
		namedTypes[signature] = name;
	}

	return errors;
};

/**
 * Validates fixed schema
 * @param {Object} schema - The fixed schema
 * @param {Object} namedTypes - Map of named types seen so far
 * @returns {Array<string>} Array of error messages
 */
const validateFixed = (schema, namedTypes = {}) => {
	const errors = [];
	const name = schema.name;

	if (!name) {
		errors.push('Fixed type must have a name');
		return errors;
	}

	if (!isPascalCase(name)) {
		errors.push(`Fixed type name "${name}" must be PascalCase`);
	}

	if (hasNonAlphanumericChars(name)) {
		errors.push(`Fixed type name "${name}" contains non-alphanumeric characters (except underscore)`);
	}

	return errors;
};

/**
 * Validates field names (should be camelCase)
 * @param {Array<Object>} fields - Array of field objects
 * @param {Object} context - Validation context
 * @returns {Array<string>} Array of error messages
 */
const validateFields = (fields, context = {}) => {
	const errors = [];

	for (const field of fields) {
		if (!field.name) {
			errors.push('Field must have a name');
			continue;
		}

		if (!isCamelCase(field.name)) {
			errors.push(`Field name "${field.name}" must be camelCase`);
		}

		if (hasNonAlphanumericChars(field.name)) {
			errors.push(`Field name "${field.name}" contains non-alphanumeric characters (except underscore)`);
		}

		// Recursively validate field type
		if (field.type) {
			errors.push(...validateSchema(field.type, context));
		}
	}

	return errors;
};

/**
 * Creates a signature for a record to detect duplicates with different names
 * @param {Object} schema - The record schema
 * @returns {string} Signature string
 */
const getRecordSignature = schema => {
	const fieldNames = (schema.fields || [])
		.map(f => f.name)
		.sort()
		.join('|');
	const fieldTypes = (schema.fields || [])
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(f => JSON.stringify(normalizeTypeForComparison(f.type)))
		.join('|');

	return `record:${fieldNames}:${fieldTypes}`;
};

/**
 * Creates a signature for an enum to detect duplicates with different names
 * @param {Object} schema - The enum schema
 * @returns {string} Signature string
 */
const getEnumSignature = schema => {
	const symbols = (schema.symbols || []).sort().join('|');
	return `enum:${symbols}`;
};

/**
 * Normalizes type for comparison (removes name to focus on structure)
 * @param {*} type - The type to normalize
 * @returns {*} Normalized type
 */
const normalizeTypeForComparison = type => {
	if (typeof type === 'string') {
		return type;
	}

	if (Array.isArray(type)) {
		return type.map(normalizeTypeForComparison);
	}

	if (typeof type === 'object' && type !== null) {
		const normalized = {};

		for (const key in type) {
			if (key === 'name' || key === 'namespace') {
				// Skip name/namespace for structural comparison
				continue;
			}

			if (key === 'fields') {
				normalized[key] = type[key]
					.map(f => ({
						name: f.name,
						type: normalizeTypeForComparison(f.type),
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			} else if (key === 'items') {
				normalized[key] = normalizeTypeForComparison(type[key]);
			} else if (key === 'values') {
				normalized[key] = normalizeTypeForComparison(type[key]);
			} else {
				normalized[key] = type[key];
			}
		}

		return normalized;
	}

	return type;
};

/**
 * Validates complete schema with all named types
 * @param {Object} schema - The root Avro schema
 * @param {Object} allDefinitions - All named type definitions from the schema
 * @returns {Array<string>} Array of error messages
 */
const validateCompleteSchema = (schema, allDefinitions = {}) => {
	const errors = [];
	const context = {
		namedTypes: {},
	};

	// Validate root schema
	errors.push(...validateSchema(schema, context));

	// Validate all definitions
	for (const name in allDefinitions) {
		const definition = allDefinitions[name];
		if (definition && definition.schema) {
			errors.push(...validateSchema(definition.schema, context));
		}
	}

	return errors;
};

module.exports = {
	validateSchema,
	validateCompleteSchema,
	validateRecord,
	validateEnum,
	validateFixed,
	validateFields,
	isPascalCase,
	isCamelCase,
	isScreamingSnakeCase,
	hasNonAlphanumericChars,
};
