/**
 * Tests for schema validator
 * Run with: node forward_engineering/helpers/schemaValidator.test.js
 */

const assert = require('assert');
const {
	validateSchema,
	validateCompleteSchema,
	validateRecord,
	validateEnum,
	validateFields,
	isPascalCase,
	isCamelCase,
	isScreamingSnakeCase,
	hasNonAlphanumericChars,
} = require('./schemaValidator');

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

// Helper to assert array contains a message
function assertContains(array, pattern) {
	const found = array.some(msg => msg.includes(pattern));
	assert(found, `Expected array to contain message matching "${pattern}". Got: ${JSON.stringify(array)}`);
}

// ============================================================================
// NAMING CONVENTION TESTS
// ============================================================================

console.log('\n=== Naming Convention Tests ===\n');

test('isPascalCase: accepts valid PascalCase', () => {
	assert(isPascalCase('MyRecord') === true);
	assert(isPascalCase('PersonName') === true);
	assert(isPascalCase('ABC') === true);
});

test('isPascalCase: rejects invalid PascalCase', () => {
	assert(isPascalCase('myRecord') === false);
	assert(isPascalCase('_MyRecord') === false);
	assert(isPascalCase('my-record') === false);
});

test('isCamelCase: accepts valid camelCase', () => {
	assert(isCamelCase('myField') === true);
	assert(isCamelCase('firstName') === true);
	assert(isCamelCase('a') === true);
});

test('isCamelCase: rejects invalid camelCase', () => {
	assert(isCamelCase('MyField') === false);
	assert(isCamelCase('_myField') === false);
	assert(isCamelCase('my-field') === false);
});

test('isScreamingSnakeCase: accepts valid SCREAMING_CASE', () => {
	assert(isScreamingSnakeCase('MY_CONSTANT') === true);
	assert(isScreamingSnakeCase('API_KEY') === true);
	assert(isScreamingSnakeCase('_1_NUMERIC_START') === true); // numeric start with underscore
});

test('isScreamingSnakeCase: rejects invalid SCREAMING_CASE', () => {
	assert(isScreamingSnakeCase('myConstant') === false);
	assert(isScreamingSnakeCase('MY-CONSTANT') === false);
	assert(isScreamingSnakeCase('MY_CONST ') === false); // space
});

test('hasNonAlphanumericChars: detects non-alphanumeric characters', () => {
	assert(hasNonAlphanumericChars('my-field') === true);
	assert(hasNonAlphanumericChars('my field') === true);
	assert(hasNonAlphanumericChars('my@field') === true);
	assert(hasNonAlphanumericChars('myField') === false);
	assert(hasNonAlphanumericChars('my_field') === false);
});

// ============================================================================
// RECORD VALIDATION TESTS
// ============================================================================

console.log('\n=== Record Validation Tests ===\n');

test('validateRecord: accepts valid PascalCase record name', () => {
	const schema = { type: 'record', name: 'MyRecord', fields: [] };
	const errors = validateRecord(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateRecord: rejects non-PascalCase record name', () => {
	const schema = { type: 'record', name: 'myRecord', fields: [] };
	const errors = validateRecord(schema);
	assertContains(errors, 'must be PascalCase');
});

test('validateRecord: rejects record with non-alphanumeric characters', () => {
	const schema = { type: 'record', name: 'My-Record', fields: [] };
	const errors = validateRecord(schema);
	assertContains(errors, 'non-alphanumeric');
});

test('validateRecord: detects duplicate records with same structure', () => {
	const schema1 = {
		type: 'record',
		name: 'Record1',
		fields: [{ name: 'field1', type: 'string' }],
	};
	const schema2 = {
		type: 'record',
		name: 'Record2',
		fields: [{ name: 'field1', type: 'string' }],
	};
	const namedTypes = {};

	validateRecord(schema1, namedTypes);
	const errors = validateRecord(schema2, namedTypes);
	assertContains(errors, 'same structure');
});

// ============================================================================
// ENUM VALIDATION TESTS
// ============================================================================

console.log('\n=== Enum Validation Tests ===\n');

test('validateEnum: accepts valid PascalCase enum name', () => {
	const schema = { type: 'enum', name: 'MyEnum', symbols: ['SYMBOL_1', 'SYMBOL_2'] };
	const errors = validateEnum(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateEnum: rejects non-PascalCase enum name', () => {
	const schema = { type: 'enum', name: 'myEnum', symbols: ['SYMBOL_1'] };
	const errors = validateEnum(schema);
	assertContains(errors, 'must be PascalCase');
});

test('validateEnum: validates enum symbols are SCREAMING_CASE', () => {
	const schema = { type: 'enum', name: 'MyEnum', symbols: ['VALID_SYMBOL', 'ANOTHER_ONE'] };
	const errors = validateEnum(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors for valid symbols, got: ${JSON.stringify(errors)}`);
});

test('validateEnum: rejects non-SCREAMING_CASE enum symbols', () => {
	const schema = { type: 'enum', name: 'MyEnum', symbols: ['validSymbol', 'ANOTHER_ONE'] };
	const errors = validateEnum(schema);
	assertContains(errors, 'must be SCREAMING_CASE');
});

test('validateEnum: allows numeric enum constants with underscore prefix', () => {
	const schema = { type: 'enum', name: 'MyEnum', symbols: ['_1', '_2', 'SYMBOL'] };
	const errors = validateEnum(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors for numeric constants, got: ${JSON.stringify(errors)}`);
});

test('validateEnum: detects duplicate enums with same symbols', () => {
	const schema1 = {
		type: 'enum',
		name: 'Enum1',
		symbols: ['SYMBOL_A', 'SYMBOL_B'],
	};
	const schema2 = {
		type: 'enum',
		name: 'Enum2',
		symbols: ['SYMBOL_A', 'SYMBOL_B'],
	};
	const namedTypes = {};

	validateEnum(schema1, namedTypes);
	const errors = validateEnum(schema2, namedTypes);
	assertContains(errors, 'same structure');
});

// ============================================================================
// FIELD VALIDATION TESTS
// ============================================================================

console.log('\n=== Field Validation Tests ===\n');

test('validateFields: accepts valid camelCase field names', () => {
	const fields = [
		{ name: 'firstName', type: 'string' },
		{ name: 'lastName', type: 'string' },
		{ name: 'age', type: 'int' },
	];
	const errors = validateFields(fields);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateFields: rejects non-camelCase field names', () => {
	const fields = [{ name: 'FirstName', type: 'string' }];
	const errors = validateFields(fields);
	assertContains(errors, 'must be camelCase');
});

test('validateFields: rejects field names with non-alphanumeric characters', () => {
	const fields = [{ name: 'first-name', type: 'string' }];
	const errors = validateFields(fields);
	assertContains(errors, 'non-alphanumeric');
});

test('validateFields: recursively validates nested types', () => {
	const fields = [
		{
			name: 'nested',
			type: {
				type: 'record',
				name: 'nestedRecord', // Invalid: should be PascalCase
				fields: [],
			},
		},
	];
	const errors = validateFields(fields);
	assertContains(errors, 'must be PascalCase');
});

// ============================================================================
// COMPLETE SCHEMA VALIDATION TESTS
// ============================================================================

console.log('\n=== Complete Schema Validation Tests ===\n');

test('validateCompleteSchema: valid simple record', () => {
	const schema = {
		type: 'record',
		name: 'Person',
		fields: [
			{ name: 'firstName', type: 'string' },
			{ name: 'lastName', type: 'string' },
			{ name: 'age', type: 'int' },
		],
	};
	const errors = validateCompleteSchema(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateCompleteSchema: catches all naming violations', () => {
	const schema = {
		type: 'record',
		name: 'person', // Invalid: should be PascalCase
		fields: [
			{ name: 'FirstName', type: 'string' }, // Invalid: should be camelCase
			{ name: 'age-field', type: 'int' }, // Invalid: non-alphanumeric
		],
	};
	const errors = validateCompleteSchema(schema);
	assert(errors.length >= 3, `Expected at least 3 errors, got: ${JSON.stringify(errors)}`);
});

test('validateCompleteSchema: validates nested records', () => {
	const schema = {
		type: 'record',
		name: 'Person',
		fields: [
			{ name: 'firstName', type: 'string' },
			{
				name: 'address',
				type: {
					type: 'record',
					name: 'Address',
					fields: [
						{ name: 'street', type: 'string' },
						{ name: 'city', type: 'string' },
					],
				},
			},
		],
	};
	const errors = validateCompleteSchema(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateCompleteSchema: validates array item types', () => {
	const schema = {
		type: 'record',
		name: 'Container',
		fields: [
			{
				name: 'items',
				type: {
					type: 'array',
					items: {
						type: 'record',
						name: 'Item', // Valid PascalCase
						fields: [{ name: 'value', type: 'string' }],
					},
				},
			},
		],
	};
	const errors = validateCompleteSchema(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateCompleteSchema: validates map value types', () => {
	const schema = {
		type: 'record',
		name: 'Container',
		fields: [
			{
				name: 'mapping',
				type: {
					type: 'map',
					values: {
						type: 'record',
						name: 'MapValue',
						fields: [{ name: 'key', type: 'string' }],
					},
				},
			},
		],
	};
	const errors = validateCompleteSchema(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateCompleteSchema: validates union types', () => {
	const schema = {
		type: 'record',
		name: 'Container',
		fields: [
			{
				name: 'unionField',
				type: [
					'null',
					{
						type: 'record',
						name: 'UnionRecord',
						fields: [{ name: 'value', type: 'string' }],
					},
				],
			},
		],
	};
	const errors = validateCompleteSchema(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('validateCompleteSchema: validates enum in schema definitions', () => {
	const schema = {
		type: 'record',
		name: 'Container',
		fields: [{ name: 'status', type: 'string' }],
	};
	const definitions = {
		Status: {
			schema: {
				type: 'enum',
				name: 'Status',
				symbols: ['ACTIVE', 'INACTIVE'],
			},
		},
	};
	const errors = validateCompleteSchema(schema, definitions);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

// ============================================================================
// COMPLEX VALIDATION TESTS
// ============================================================================

console.log('\n=== Complex Validation Tests ===\n');

test('validates complex real-world-like schema', () => {
	const schema = {
		type: 'record',
		name: 'Order',
		fields: [
			{ name: 'orderId', type: 'string' },
			{ name: 'customerName', type: 'string' },
			{
				name: 'items',
				type: {
					type: 'array',
					items: {
						type: 'record',
						name: 'OrderItem',
						fields: [
							{ name: 'itemId', type: 'string' },
							{ name: 'quantity', type: 'int' },
							{ name: 'unitPrice', type: 'double' },
						],
					},
				},
			},
			{
				name: 'status',
				type: {
					type: 'enum',
					name: 'OrderStatus',
					symbols: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
				},
			},
		],
	};
	const errors = validateCompleteSchema(schema);
	assert.strictEqual(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

test('catches naming errors in complex schema', () => {
	const schema = {
		type: 'record',
		name: 'Order', // Valid
		fields: [
			{ name: 'order_id', type: 'string' }, // Invalid: snake_case instead of camelCase
			{
				name: 'items',
				type: {
					type: 'array',
					items: {
						type: 'record',
						name: 'order_item', // Invalid: snake_case instead of PascalCase
						fields: [
							{ name: 'item_id', type: 'string' }, // Invalid: snake_case instead of camelCase
						],
					},
				},
			},
		],
	};
	const errors = validateCompleteSchema(schema);
	assert(errors.length >= 3, `Expected at least 3 errors, got: ${JSON.stringify(errors)}`);
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
