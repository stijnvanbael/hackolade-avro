/**
 * Integration tests for schema validation with conversion
 * Run with: node forward_engineering/helpers/convertJsonSchemaToAvro.test.js
 */

const assert = require('assert');
const convertSchema = require('./convertJsonSchemaToAvro');
const { addDefinitions, clearDefinitions, resetDefinitionsUsage, resolveUdt } = require('./udtHelper');

const TEST_RESULTS = {
	passed: 0,
	failed: 0,
	errors: [],
};

function test(description, testFn) {
	try {
		testFn();
		TEST_RESULTS.passed++;
		console.log(`✓ ${description}`);
	} catch (error) {
		TEST_RESULTS.failed++;
		TEST_RESULTS.errors.push(`✗ ${description}: ${error.message}`);
		console.error(`✗ ${description}`);
		console.error(`  ${error.message}`);
	}
}

// ============================================================================
// CONVERSION WITH NAME NORMALIZATION TESTS
// ============================================================================

console.log('\n=== Conversion with Name Normalization Tests ===\n');

test('convertSchema: valid schema with sanity checks enabled throws no error', () => {
	const schema = {
		type: 'record',
		name: 'Person',
		properties: {
			firstName: { type: 'string' },
			lastName: { type: 'string' },
			age: { type: 'number' },
		},
	};

	// Should not throw
	const result = convertSchema(schema, { enableSanityChecks: true });
	assert(result !== undefined, 'Schema should be converted');
});

test('convertSchema: type names are auto-converted to PascalCase', () => {
	const schema = {
		type: 'record',
		name: 'person',
		properties: {
			firstName: { type: 'string' },
		},
	};

	const result = convertSchema(schema, { enableSanityChecks: true });
	assert.strictEqual(result.name, 'Person', 'Record name should be converted to PascalCase');
});

test('convertSchema: disabling sanity checks keeps conversion working', () => {
	const schema = {
		type: 'record',
		name: 'person',
		properties: {
			firstName: { type: 'string' },
		},
	};

	const result = convertSchema(schema, { enableSanityChecks: false });
	assert(result !== undefined, 'Schema should still be converted when sanity checks are disabled');
});

test('convertSchema: field names are auto-converted to camelCase', () => {
	const schema = {
		type: 'record',
		name: 'Person',
		properties: {
			First_Name: { type: 'string' },
		},
	};

	const result = convertSchema(schema, { enableSanityChecks: true });
	assert.strictEqual(result.fields[0].name, 'firstName', 'Field name should be converted to camelCase');
});

test('convertSchema: complex nested schema validation', () => {
	const schema = {
		type: 'record',
		name: 'order_record',
		properties: {
			Order_Id: { type: 'string' },
			items: {
				type: 'array',
				items: {
					type: 'record',
					name: 'order_item',
					properties: {
						Item_Id: { type: 'string' },
						quantity: { type: 'number' },
					},
				},
			},
		},
	};

	const result = convertSchema(schema, { enableSanityChecks: true });
	assert.strictEqual(result.name, 'OrderRecord', 'Root record should be PascalCase');
	assert.strictEqual(result.fields[0].name, 'orderId', 'Root field should be camelCase');
	assert.strictEqual(result.fields[1].type.items.name, 'OrderItem', 'Nested record should be PascalCase');
	assert.strictEqual(result.fields[1].type.items.fields[0].name, 'itemId', 'Nested field should be camelCase');
});

test('validateSchemaOrThrow: throws on validation failure', () => {
	const schema = {
		type: 'record',
		name: 'invalid_record', // Invalid: should be PascalCase
		fields: [],
	};

	let threw = false;
	try {
		convertSchema.validateSchemaOrThrow(schema, {}, { enableSanityChecks: true });
	} catch (error) {
		threw = true;
		assert(error.message.includes('Schema validation failed'), 'Should throw validation error');
	}

	assert(threw === true, 'Should have thrown an error');
});

test('validateSchemaOrThrow: does not throw when sanity checks disabled', () => {
	const schema = {
		type: 'record',
		name: 'invalid_record', // Invalid: should be PascalCase
		fields: [],
	};

	// Should not throw
	convertSchema.validateSchemaOrThrow(schema, {}, { enableSanityChecks: false });
});

test('validateCompleteSchema: validates multiple definitions', () => {
	const schema = {
		type: 'record',
		name: 'Container',
		fields: [],
	};

	const definitions = {
		Person: {
			schema: {
				type: 'record',
				name: 'Person',
				fields: [{ name: 'firstName', type: 'string' }],
			},
		},
		Status: {
			schema: {
				type: 'enum',
				name: 'Status',
				symbols: ['ACTIVE', 'INACTIVE'],
			},
		},
	};

	const errors = convertSchema.validateCompleteSchema(schema, definitions);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

// ============================================================================
// SHARED ENUM / $REF RESOLUTION TESTS
// ============================================================================

console.log('\n=== Shared Enum $ref Resolution Tests ===\n');

test('shared enum referenced via $ref gets a PascalCase type name', () => {
	// Simulate a field whose type comes from a shared enum stored under a camelCase key.
	// getTypeFromReference must return the PascalCase version so it matches the UDT key.
	const getTypeFromReference = require('./getTypeFromReference');

	// $ref with camelCase last segment
	const schema = { $ref: '#/definitions/orderStatus' };
	const result = getTypeFromReference(schema);
	assert.strictEqual(result, 'OrderStatus', 'Type reference should be PascalCase');
});

test('shared enum referenced via $ref with namespace preserves namespace', () => {
	const getTypeFromReference = require('./getTypeFromReference');

	const schema = { $ref: '#/definitions/orderStatus', namespace: 'com.example' };
	const result = getTypeFromReference(schema);
	assert.strictEqual(result, 'com.example.OrderStatus', 'Namespace should be preserved, name should be PascalCase');
});

test('shared enum definition is emitted (not just a reference) the first time it is used', () => {
	// Set up UDT exactly as convertSchemaToUserDefinedTypes does: key = toPascalCaseName(key)
	clearDefinitions();

	const enumSchema = {
		type: 'enum',
		name: 'OrderStatus',
		symbols: ['PENDING', 'SHIPPED', 'DELIVERED'],
	};

	addDefinitions({
		OrderStatus: {
			schema: enumSchema,
			customProperties: {},
			originalSchema: enumSchema,
			// no 'used' flag — reset will clear it
		},
	});
	resetDefinitionsUsage();

	// A record that references the shared enum via a field whose type is 'OrderStatus'
	const avroSchema = {
		type: 'record',
		name: 'Order',
		fields: [{ name: 'status', type: 'OrderStatus' }],
	};

	const resolved = resolveUdt(avroSchema);

	// The status field's type should be the full enum definition (an object), not just the string
	const statusField = resolved.fields.find(f => f.name === 'status');
	assert(statusField, 'status field should exist');
	assert.strictEqual(
		typeof statusField.type,
		'object',
		'First use should emit the full enum definition, not a string reference',
	);
	assert.strictEqual(statusField.type.type, 'enum', 'Emitted definition should have type "enum"');
	assert.deepStrictEqual(statusField.type.symbols, ['PENDING', 'SHIPPED', 'DELIVERED'], 'Symbols should be present');
	assert.strictEqual(statusField.type.name, 'OrderStatus', 'Enum name should be PascalCase');
});

test('shared enum referenced a second time becomes a string reference', () => {
	clearDefinitions();

	const enumSchema = {
		type: 'enum',
		name: 'OrderStatus',
		symbols: ['PENDING', 'SHIPPED', 'DELIVERED'],
	};

	addDefinitions({
		OrderStatus: {
			schema: enumSchema,
			customProperties: {},
			originalSchema: enumSchema,
		},
	});
	resetDefinitionsUsage();

	const avroSchema = {
		type: 'record',
		name: 'Order',
		fields: [
			{ name: 'status', type: 'OrderStatus' },
			{ name: 'prevStatus', type: 'OrderStatus' },
		],
	};

	const resolved = resolveUdt(avroSchema);

	const statusField = resolved.fields.find(f => f.name === 'status');
	const prevStatusField = resolved.fields.find(f => f.name === 'prevStatus');

	assert(statusField, 'status field should exist');
	assert(prevStatusField, 'prevStatus field should exist');

	// First reference → full definition
	assert.strictEqual(typeof statusField.type, 'object', 'First use should be full definition');
	// Second reference → just the name string
	assert.strictEqual(prevStatusField.type, 'OrderStatus', 'Second use should be a string reference');
});

test('shared enum with camelCase key is found when referenced via lowercase $ref', () => {
	// Regression: UDT key is PascalCase; $ref has camelCase segment; must still resolve.
	clearDefinitions();

	const enumSchema = {
		type: 'enum',
		name: 'MyStatus',
		symbols: ['ACTIVE', 'INACTIVE'],
	};

	addDefinitions({
		MyStatus: {
			// PascalCase key (as stored by convertSchemaToUserDefinedTypes)
			schema: enumSchema,
			customProperties: {},
			originalSchema: enumSchema,
		},
	});
	resetDefinitionsUsage();

	// Field with $ref pointing to camelCase key in the JSON schema definitions
	const fieldSchema = { $ref: '#/definitions/myStatus' };
	const getTypeFromReference = require('./getTypeFromReference');
	const resolvedType = getTypeFromReference(fieldSchema); // should be 'MyStatus'

	assert.strictEqual(resolvedType, 'MyStatus', 'getTypeFromReference must return PascalCase to match UDT key');

	const avroSchema = {
		type: 'record',
		name: 'Container',
		fields: [{ name: 'statusField', type: resolvedType }],
	};

	const resolved = resolveUdt(avroSchema);
	const field = resolved.fields[0];
	assert.strictEqual(typeof field.type, 'object', 'Full enum definition should be emitted');
	assert.strictEqual(field.type.name, 'MyStatus', 'Enum name should be PascalCase');
});

// ============================================================================
// TEST RESULTS
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`\nTest Results: ${TEST_RESULTS.passed} passed, ${TEST_RESULTS.failed} failed\n`);

if (TEST_RESULTS.failed > 0) {
	console.log('Failures:');
	TEST_RESULTS.errors.forEach(error => console.log(error));
	process.exit(1);
} else {
	console.log('All tests passed! ✓');
	process.exit(0);
}
