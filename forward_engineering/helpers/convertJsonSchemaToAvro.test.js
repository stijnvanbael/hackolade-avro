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
// POLYGLOT / DOCUMENT-TYPE / SELF-REFERENTIAL SCHEMA TESTS
// ============================================================================

console.log('\n=== Polyglot & Document Type Tests ===\n');

test('type "document" is treated as a record and its fields are preserved', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	// Hackolade passes polyglot record definitions with type "document"
	const schema = {
		type: 'document',
		name: 'MyRecord',
		properties: {
			myField: { type: 'string' },
		},
	};

	const result = convertSchema(schema);
	assert.strictEqual(result.type, 'record', 'type "document" should be converted to "record"');
	assert.strictEqual(result.name, 'MyRecord', 'name should be preserved');
	assert(Array.isArray(result.fields), 'fields should be an array');
	assert.strictEqual(result.fields.length, 1, 'Should have one field');
	assert.strictEqual(result.fields[0].name, 'myField', 'Field name should be preserved');
});

test('field referencing a self-referential UDT entry is present (not absent)', () => {
	// Simulates what happens when a model definition is an unresolved polyglot reference stub:
	// convertSchemaToUserDefinedTypes stores schema = "TypeName" (self-referential).
	clearDefinitions();
	addDefinitions({
		LinkedRecord: {
			schema: {
				type: 'record',
				name: 'LinkedRecord',
				fields: [
					{ name: 'fieldA', type: 'string' },
					{ name: 'sharedRef', type: 'UnresolvableType' },
				],
			},
			customProperties: {},
			originalSchema: {},
		},
		// Self-referential: this is what happens when the definition is a reference stub
		UnresolvableType: {
			schema: 'UnresolvableType',
			customProperties: {},
			originalSchema: { type: 'reference', $ref: '#external/definitions/UnresolvableType' },
		},
	});
	resetDefinitionsUsage();

	const avroSchema = {
		type: 'record',
		name: 'Container',
		fields: [{ name: 'linked', type: 'LinkedRecord' }],
	};

	const result = resolveUdt(avroSchema);
	const linkedField = result.fields[0];
	assert(linkedField, 'Container should have a linked field');
	const linkedType = linkedField.type;
	assert(linkedType && linkedType.fields, 'LinkedRecord should have fields');

	// All fields should be present, including sharedRef
	const fieldNames = linkedType.fields.map(f => f.name);
	assert(fieldNames.includes('fieldA'), 'fieldA should be present');
	assert(fieldNames.includes('sharedRef'), 'sharedRef should be present (not silently dropped)');
	assert.strictEqual(
		linkedType.fields.find(f => f.name === 'sharedRef').type,
		'UnresolvableType',
		'sharedRef type should be a forward reference string',
	);
});

test('two entities sharing the same record type both have all their fields', () => {
	// Regression: when 2 types both reference the same shared record, fields must not disappear.
	clearDefinitions();

	const sharedRecordSchema = {
		type: 'record',
		name: 'SharedRecord',
		fields: [{ name: 'value', type: 'string' }],
	};

	addDefinitions({
		SharedRecord: {
			schema: sharedRecordSchema,
			customProperties: {},
			originalSchema: sharedRecordSchema,
		},
	});
	resetDefinitionsUsage();

	// Entity 1 has a field of type SharedRecord
	const entity1 = {
		type: 'record',
		name: 'Entity1',
		fields: [{ name: 'shared', type: 'SharedRecord' }],
	};
	const result1 = resolveUdt(entity1);
	const shared1 = result1.fields.find(f => f.name === 'shared');
	assert(shared1, 'Entity1 should have shared field');
	assert.strictEqual(shared1.type.type, 'record', 'First use should emit full definition');
	assert.strictEqual(shared1.type.name, 'SharedRecord');

	// Reset for Entity 2 (simulates new entity pass)
	clearDefinitions();
	addDefinitions({
		SharedRecord: {
			schema: sharedRecordSchema,
			customProperties: {},
			originalSchema: sharedRecordSchema,
		},
	});
	resetDefinitionsUsage();

	// Entity 2 also has a field of type SharedRecord
	const entity2 = {
		type: 'record',
		name: 'Entity2',
		fields: [{ name: 'shared', type: 'SharedRecord' }],
	};
	const result2 = resolveUdt(entity2);
	const shared2 = result2.fields.find(f => f.name === 'shared');
	assert(shared2, 'Entity2 should have shared field');
	assert.strictEqual(shared2.type.type, 'record', 'Entity2 first use should also emit full definition');
});

test('two fields in same entity sharing the same record type: first is full, second is reference', () => {
	clearDefinitions();

	const sharedEnumSchema = {
		type: 'enum',
		name: 'SharedEnum',
		symbols: ['A', 'B'],
	};

	addDefinitions({
		SharedEnum: {
			schema: sharedEnumSchema,
			customProperties: {},
			originalSchema: sharedEnumSchema,
		},
	});
	resetDefinitionsUsage();

	const avroSchema = {
		type: 'record',
		name: 'MyRecord',
		fields: [
			{ name: 'first', type: 'SharedEnum' },
			{ name: 'second', type: 'SharedEnum' },
		],
	};

	const result = resolveUdt(avroSchema);
	assert.strictEqual(result.fields.length, 2, 'Both fields should be present');
	assert.strictEqual(typeof result.fields[0].type, 'object', 'First use should be full definition');
	assert.strictEqual(result.fields[0].type.type, 'enum');
	assert.strictEqual(result.fields[1].type, 'SharedEnum', 'Second use should be a reference string');
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
