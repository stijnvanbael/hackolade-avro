/**
 * Tests for schema sanitization
 * Run with: node forward_engineering/helpers/sanitizationHelper.test.js
 */

const assert = require('assert');
const { sanitizeTypeName, sanitizeFieldName, sanitizeSchema } = require('./sanitizationHelper');

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
// TYPE NAME SANITIZATION TESTS
// ============================================================================

console.log('\n=== Type Name Sanitization Tests ===\n');

test('sanitizeTypeName: converts to PascalCase', () => {
	assert.strictEqual(sanitizeTypeName('myRecord'), 'MyRecord');
	assert.strictEqual(sanitizeTypeName('my_record'), 'MyRecord');
	assert.strictEqual(sanitizeTypeName('my-record'), 'MyRecord');
});

test('sanitizeTypeName: handles already PascalCase names', () => {
	assert.strictEqual(sanitizeTypeName('MyRecord'), 'MyRecord');
	assert.strictEqual(sanitizeTypeName('PersonName'), 'PersonName');
});

test('sanitizeTypeName: removes non-alphanumeric characters', () => {
	assert.strictEqual(sanitizeTypeName('my@record'), 'MyRecord');
	assert.strictEqual(sanitizeTypeName('my.record.name'), 'MyRecordName');
});

// ============================================================================
// FIELD NAME SANITIZATION TESTS
// ============================================================================

console.log('\n=== Field Name Sanitization Tests ===\n');

test('sanitizeFieldName: converts to camelCase', () => {
	assert.strictEqual(sanitizeFieldName('MyField'), 'myField');
	assert.strictEqual(sanitizeFieldName('my_field'), 'myField');
	assert.strictEqual(sanitizeFieldName('my-field'), 'myField');
});

test('sanitizeFieldName: handles already camelCase names', () => {
	assert.strictEqual(sanitizeFieldName('myField'), 'myField');
	assert.strictEqual(sanitizeFieldName('firstName'), 'firstName');
});

test('sanitizeFieldName: removes non-alphanumeric characters', () => {
	assert.strictEqual(sanitizeFieldName('my@field'), 'myField');
	assert.strictEqual(sanitizeFieldName('my.field.name'), 'myFieldName');
});

// ============================================================================
// SCHEMA SANITIZATION TESTS
// ============================================================================

console.log('\n=== Schema Sanitization Tests ===\n');

test('sanitizeSchema: sanitizes record name and field names', () => {
	const schema = {
		type: 'record',
		name: 'my_record',
		fields: [
			{ name: 'MyField', type: 'string' },
			{ name: 'another_field', type: 'int' },
		],
	};

	const sanitized = sanitizeSchema(schema);

	assert.strictEqual(sanitized.name, 'MyRecord');
	assert.strictEqual(sanitized.fields[0].name, 'myField');
	assert.strictEqual(sanitized.fields[1].name, 'anotherField');
});

test('sanitizeSchema: sanitizes enum name and preserves symbols', () => {
	const schema = {
		type: 'enum',
		name: 'my_enum',
		symbols: ['mySymbol', 'another_symbol', 'E17', '_23'],
	};

	const sanitized = sanitizeSchema(schema);

	assert.strictEqual(sanitized.name, 'MyEnum');
	assert.strictEqual(sanitized.symbols[0], 'mySymbol');
	assert.strictEqual(sanitized.symbols[1], 'another_symbol');
	assert.strictEqual(sanitized.symbols[2], 'E17');
	assert.strictEqual(sanitized.symbols[3], '_23');
});

test('sanitizeSchema: sanitizes fixed name', () => {
	const schema = {
		type: 'fixed',
		name: 'my_fixed',
		size: 16,
	};

	const sanitized = sanitizeSchema(schema);

	assert.strictEqual(sanitized.name, 'MyFixed');
	assert.strictEqual(sanitized.size, 16);
});

test('sanitizeSchema: recursively sanitizes array items', () => {
	const schema = {
		type: 'array',
		items: {
			type: 'record',
			name: 'item_record',
			fields: [{ name: 'itemField', type: 'string' }],
		},
	};

	const sanitized = sanitizeSchema(schema);

	assert.strictEqual(sanitized.items.name, 'ItemRecord');
	assert.strictEqual(sanitized.items.fields[0].name, 'itemField');
});

test('sanitizeSchema: recursively sanitizes map values', () => {
	const schema = {
		type: 'map',
		values: {
			type: 'record',
			name: 'value_record',
			fields: [{ name: 'valueField', type: 'string' }],
		},
	};

	const sanitized = sanitizeSchema(schema);

	assert.strictEqual(sanitized.values.name, 'ValueRecord');
	assert.strictEqual(sanitized.values.fields[0].name, 'valueField');
});

test('sanitizeSchema: sanitizes union types', () => {
	const schema = {
		type: ['null', { type: 'enum', name: 'my_enum', symbols: ['value1', 'E17', '_23'] }],
	};

	const sanitized = sanitizeSchema(schema);

	assert(Array.isArray(sanitized.type));
	assert.strictEqual(sanitized.type[1].name, 'MyEnum');
	assert.deepStrictEqual(sanitized.type[1].symbols, ['value1', 'E17', '_23']);
});

test('sanitizeSchema: handles special characters in names', () => {
	const schema = {
		type: 'record',
		name: 'my-record@v1',
		fields: [
			{ name: 'field-name$1', type: 'string' },
			{ name: 'another.field', type: 'int' },
		],
	};

	const sanitized = sanitizeSchema(schema);

	assert.strictEqual(sanitized.name, 'MyRecordV1');
	assert.strictEqual(sanitized.fields[0].name, 'fieldName1');
	assert.strictEqual(sanitized.fields[1].name, 'anotherField');
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
	console.log(`\n✓ All tests passed!`);
	process.exit(0);
}
