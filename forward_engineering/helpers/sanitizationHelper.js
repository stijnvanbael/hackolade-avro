const { toPascalCaseName, toCamelCaseName } = require('./generalHelper');

/**
 * Sanitizes record and enum names to PascalCase
 * Removes non-alphanumeric characters
 * @param {string} name - The name to sanitize
 * @returns {string} - The sanitized name
 */
const sanitizeTypeName = name => {
	if (!name) {
		return name;
	}

	// Use existing toPascalCaseName which already handles most cases
	return toPascalCaseName(name);
};

/**
 * Sanitizes field names to camelCase
 * Removes non-alphanumeric characters
 * @param {string} name - The name to sanitize
 * @returns {string} - The sanitized name
 */
const sanitizeFieldName = name => {
	if (!name) {
		return name;
	}

	// Use existing toCamelCaseName which already handles most cases
	return toCamelCaseName(name);
};

/**
 * Recursively sanitizes an Avro schema
 * Applies naming conventions based on the type and context
 * @param {Object} schema - The schema to sanitize
 * @param {boolean} [isFieldContext=false] - Whether this is a field context
 * @returns {Object} - The sanitized schema
 */
const sanitizeSchema = (schema, isFieldContext = false) => {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item, index) => sanitizeSchema(item, isFieldContext && index === 0));
	}

	let sanitized = { ...schema };

	// Sanitize record names
	if (sanitized.type === 'record' && sanitized.name) {
		sanitized.name = sanitizeTypeName(sanitized.name);

		// Sanitize fields
		if (sanitized.fields && Array.isArray(sanitized.fields)) {
			sanitized.fields = sanitized.fields.map(field => ({
				...field,
				name: sanitizeFieldName(field.name),
				type: sanitizeSchema(field.type, false),
			}));
		}
	}

	// Sanitize enum names. Symbols must stay as provided by the source schema.
	if (sanitized.type === 'enum' && sanitized.name) {
		sanitized.name = sanitizeTypeName(sanitized.name);
	}

	// Sanitize fixed names
	if (sanitized.type === 'fixed' && sanitized.name) {
		sanitized.name = sanitizeTypeName(sanitized.name);
	}

	// Recursively sanitize map values
	if (sanitized.type === 'map' && sanitized.values) {
		sanitized.values = sanitizeSchema(sanitized.values, false);
	}

	// Recursively sanitize array items
	if (sanitized.type === 'array' && sanitized.items) {
		sanitized.items = sanitizeSchema(sanitized.items, false);
	}

	// Handle union types (array of types)
	if (Array.isArray(sanitized.type)) {
		sanitized.type = sanitized.type.map(type => sanitizeSchema(type, false));
	}

	return sanitized;
};

module.exports = {
	sanitizeTypeName,
	sanitizeFieldName,
	sanitizeSchema,
};
