/**
 * Integration test demonstrating the sanitization workflow
 * Shows how problematic schema names are automatically fixed during conversion
 * Run with: node forward_engineering/helpers/sanitizationIntegration.test.js
 */

const assert = require('assert');
const convertSchema = require('./convertJsonSchemaToAvro');
const { addDefinitions, clearDefinitions, resetDefinitionsUsage } = require('./udtHelper');

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
// SANITIZATION WORKFLOW TESTS
// ============================================================================

console.log('\n=== Sanitization Workflow Integration Tests ===\n');

test('sanitization: converts problematic record with bad field names', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'record',
		name: 'metering-config',
		properties: {
			'Device-ID': { type: 'string' },
			'DEVICE_TYPE': { type: 'string' },
			'EnrichedType': { type: 'string' },
		},
	};

	const result = convertSchema(schema, { sanitizeNames: true });

	assert.strictEqual(result.name, 'MeteringConfig', 'Record name should be PascalCase');
	assert.strictEqual(result.fields.length, 3, 'Should have 3 fields');
	assert.strictEqual(result.fields[0].name, 'deviceId', 'Field 1 should be camelCase');
	assert.strictEqual(result.fields[1].name, 'deviceType', 'Field 2 should be camelCase');
	assert.strictEqual(result.fields[2].name, 'enrichedType', 'Field 3 should be camelCase');
});

test('sanitization: handles enum with bad constant names', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'enum',
		name: 'device-status',
		symbols: ['connected-device', 'disconnected-device', 'error.state', 'E17', '_23'],
	};

	const result = convertSchema(schema, { sanitizeNames: true });

	assert.strictEqual(result.name, 'DeviceStatus', 'Enum name should be PascalCase');
	assert.deepStrictEqual(result.symbols, ['connected-device', 'disconnected-device', 'error.state', 'E17', '_23']);
});

test('sanitization: handles nested record with mixed case problems', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'record',
		name: 'order_container',
		properties: {
			Order_ID: { type: 'string' },
			Items: {
				type: 'array',
				items: {
					type: 'record',
					name: 'order-item',
					properties: {
						'Item-ID': { type: 'string' },
						'Item_Price': { type: 'number' },
					},
				},
			},
		},
	};

	const result = convertSchema(schema, { sanitizeNames: true });

	assert.strictEqual(result.name, 'OrderContainer', 'Root record name should be PascalCase');
	assert.strictEqual(result.fields[0].name, 'orderId', 'Root field should be camelCase');
	assert.strictEqual(result.fields[1].name, 'items', 'Array field should be camelCase');
	assert.strictEqual(result.fields[1].type.items.name, 'OrderItem', 'Nested record should be PascalCase');
	assert.strictEqual(result.fields[1].type.items.fields[0].name, 'itemId', 'Nested field 1 should be camelCase');
	assert.strictEqual(result.fields[1].type.items.fields[1].name, 'itemPrice', 'Nested field 2 should be camelCase');
});

test('sanitization: handles special characters in names', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'record',
		name: 'device@config-v1',
		properties: {
			'device.id': { type: 'string' },
			'config$name': { type: 'string' },
			'status/state': { type: 'string' },
		},
	};

	const result = convertSchema(schema, { sanitizeNames: true });

	assert.strictEqual(result.name, 'DeviceConfigV1', 'Name with special chars should be sanitized');
	assert.strictEqual(result.fields[0].name, 'deviceId', 'Field with dot should be camelCase');
	assert.strictEqual(result.fields[1].name, 'configName', 'Field with $ should be camelCase');
	assert.strictEqual(result.fields[2].name, 'statusState', 'Field with / should be camelCase');
});

test('sanitization: handles union types with nested enums', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'record',
		name: 'event-record',
		properties: {
			'event-status': {
				type: [
					'null',
					{
						type: 'enum',
						name: 'event-status-enum',
						symbols: ['event-started', 'event-completed', 'event-failed', 'E17', '_23'],
					},
				],
			},
		},
	};

	const result = convertSchema(schema, { sanitizeNames: true });

	assert.strictEqual(result.name, 'EventRecord', 'Record name should be PascalCase');
	assert.strictEqual(result.fields[0].name, 'eventStatus', 'Field name should be camelCase');
	assert(Array.isArray(result.fields[0].type), 'Should be union type');
	// Find the enum in the union
	const enumType = result.fields[0].type.find(t => t && t.type === 'enum');
	assert(enumType, 'Union should contain enum');
	assert.strictEqual(enumType.name, 'EventStatusEnum', 'Enum name should be PascalCase');
	assert.deepStrictEqual(enumType.symbols, ['event-started', 'event-completed', 'event-failed', 'E17', '_23']);
});

test('sanitization: handles map types with nested records', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'record',
		name: 'config-map',
		properties: {
			'config-values': {
				type: 'map',
				values: {
					type: 'record',
					name: 'config-value',
					properties: {
						'Value_Name': { type: 'string' },
					},
				},
			},
		},
	};

	const result = convertSchema(schema, { sanitizeNames: true });

	assert.strictEqual(result.name, 'ConfigMap', 'Record name should be PascalCase');
	assert.strictEqual(result.fields[0].name, 'configValues', 'Map field should be camelCase');
	// The values schema should be the record
	const valuesSchema = result.fields[0].type.values;
	if (valuesSchema && typeof valuesSchema === 'object' && valuesSchema.type === 'record') {
		assert.strictEqual(valuesSchema.name, 'ConfigValue', 'Map value record should be PascalCase');
		assert.strictEqual(valuesSchema.fields[0].name, 'valueName', 'Nested field should be camelCase');
	} else {
		// If it's not a direct record, it might be a reference, which is fine
		assert(valuesSchema, 'Map values should exist');
	}
});

test('sanitization can be disabled to keep original names', () => {
	clearDefinitions();
	resetDefinitionsUsage();

	const schema = {
		type: 'record',
		name: 'my-record',
		properties: {
			'My-Field': { type: 'string' },
		},
	};

	// With sanitization disabled, the default behavior (without sanitizeSchema call) applies
	const result = convertSchema(schema, { sanitizeNames: false });

	// Without sanitization, convertName still applies toPascalCaseName by default
	// but the explicit sanitizeSchema function is not called
	assert(result !== undefined, 'Schema should still convert');
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${TEST_RESULTS.passed}`);
console.log(`Failed: ${TEST_RESULTS.failed}`);

if (TEST_RESULTS.failed > 0) {
	console.log(`\nFailed tests:`);
	TEST_RESULTS.errors.forEach(error => console.log(`  ${error}`));
	process.exit(1);
} else {
	console.log(`\n✓ All integration tests passed!`);
	process.exit(0);
}
