const assert = require('assert');
const { _test } = require('./api');

const { includeFieldSamplesInSchema } = _test;

const TEST_RESULTS = {
	passed: 0,
	failed: 0,
};

const test = (description, fn) => {
	try {
		fn();
		TEST_RESULTS.passed += 1;
		console.log(`[PASS] ${description}`);
	} catch (error) {
		TEST_RESULTS.failed += 1;
		console.error(`[FAIL] ${description}`);
		console.error(`  ${error.message}`);
	}
};

console.log('\n=== Forward Engineering Option Resolution Tests ===\n');

test('includes field samples when option is missing (default enabled)', () => {
	assert.strictEqual(includeFieldSamplesInSchema({ additionalOptions: [] }), true);
});

test('disables field samples when INCLUDE_FIELD_SAMPLES is false', () => {
	assert.strictEqual(
		includeFieldSamplesInSchema({
			additionalOptions: [{ id: 'INCLUDE_FIELD_SAMPLES', value: false }],
		}),
		false,
	);
});

test('disables field samples when INCLUDE_FIELD_SAMPLES is string "false"', () => {
	assert.strictEqual(
		includeFieldSamplesInSchema({
			additionalOptions: [{ id: 'INCLUDE_FIELD_SAMPLES', value: 'false' }],
		}),
		false,
	);
});

test('accepts CLI id variants with different separators and casing', () => {
	assert.strictEqual(
		includeFieldSamplesInSchema({
			additionalOptions: [{ id: 'include-field-samples', value: true }],
		}),
		true,
	);
});

console.log(`\nPassed: ${TEST_RESULTS.passed}`);
console.log(`Failed: ${TEST_RESULTS.failed}`);

if (TEST_RESULTS.failed > 0) {
	process.exit(1);
}


