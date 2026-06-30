# Schema Sanity Checks Implementation

## Overview

This implementation adds optional schema sanity checks to the Hackolade Avro plugin that validate naming conventions in Avro schemas. The sanity checks are **enabled by default** and can be disabled through a configuration option.

## Features

### Sanity Check Rules

The schema validator enforces the following naming conventions:

1. **Record and Enum Names**: Must be `PascalCase`
   - Valid: `Person`, `UserAccount`, `OrderItem`
   - Invalid: `person`, `user_account`, `order-item`

2. **Field Names**: Must be `camelCase`
   - Valid: `firstName`, `emailAddress`, `isActive`
   - Invalid: `FirstName`, `email_address`, `is-active`

3. **Enum Constants**: Must be `SCREAMING_CASE`
   - Valid: `ACTIVE`, `PROCESSING`, `_1_NUMERIC_START`
   - Invalid: `Active`, `processing`, `active-status`
   - Special case: Numeric constants can start with underscore (e.g., `_1`, `_2`)

4. **Alphanumeric Requirement**: No non-alphanumeric characters (except underscores) in names
   - Valid: `myField`, `my_field`, `MyRecord`
   - Invalid: `my-field`, `my field`, `my@field`

5. **Duplicate Detection**: Records and enums with identical structure must have the same name
   - If two records have the same fields with same types, they should have the same name
   - If two enums have the same symbols, they should have the same name

### Error Handling

When validation fails, users receive clear error messages indicating:
- What validation rule was violated
- Which field/type caused the violation
- What the correct format should be

Example error message:
```
Schema validation failed with the following errors:
- Record name "person" must be PascalCase
- Field name "FirstName" must be camelCase
- Enum symbol "symbol" must be SCREAMING_CASE (allow numeric start with underscore)
```

## Configuration

### Enabling/Disabling Sanity Checks

A new configuration option has been added to `forward_engineering/config.json`:

```json
{
  "id": "enableSanityChecks",
  "value": true,
  "name": "Enable naming sanity checks",
  "description": "Verify records/enums are PascalCase, fields are camelCase, enum constants are SCREAMING_CASE"
}
```

This option appears in the UI under "Additional Options" and is **enabled by default**.

### How to Use

1. In the Hackolade UI, when generating Avro schemas, you'll see the "Enable naming sanity checks" checkbox
2. It's checked by default - uncheck to disable validation
3. If validation fails with the option enabled, generation will fail with clear error messages

## Implementation Details

### Files Added

1. **`forward_engineering/helpers/schemaValidator.js`** - Core validation logic
   - Defines naming convention validators
   - Implements recursive schema validation
   - Detects duplicate types

2. **`forward_engineering/helpers/schemaValidator.test.js`** - Comprehensive tests (30 test cases)
   - Tests all naming conventions
   - Tests nested schema validation
   - Tests error detection and messages

3. **`forward_engineering/helpers/convertJsonSchemaToAvro.test.js`** - Integration tests (8 test cases)
   - Tests validation integration with schema conversion
   - Tests enable/disable functionality

### Files Modified

1. **`forward_engineering/helpers/convertJsonSchemaToAvro.js`**
   - Added import for schema validator
   - Integrated validation at end of `convertSchema()` function
   - Exported `validateSchemaOrThrow()` and `validateCompleteSchema()` functions

2. **`forward_engineering/api.js`**
   - Added `getSanityChecksEnabled()` helper function
   - Updated `convertJsonToAvro()` to accept options parameter
   - Updated both calls to `convertJsonToAvro()` to pass options

3. **`forward_engineering/config.json`**
   - Added new `enableSanityChecks` configuration option

## Testing

### Running Tests

All tests are in Node.js using the built-in `assert` module (no external dependencies):

```bash
# Test schema validator rules and logic
node forward_engineering/helpers/schemaValidator.test.js

# Test integration with schema conversion
node forward_engineering/helpers/convertJsonSchemaToAvro.test.js
```

### Test Coverage

- **30 tests** in schemaValidator.test.js covering:
  - Naming convention detection (7 tests)
  - Record validation (4 tests)
  - Enum validation (6 tests)
  - Field validation (4 tests)
  - Complete schema validation (5 tests)
  - Complex real-world schemas (4 tests)

- **8 tests** in convertJsonSchemaToAvro.test.js covering:
  - Integration with conversion process
  - Enable/disable functionality
  - Nested schema validation
  - Definition validation

All 38 tests pass successfully.

## Example Usage

### Valid Schema (Will Pass Validation)

```javascript
{
  type: 'record',
  name: 'Person',                    // ✓ PascalCase
  fields: [
    { name: 'firstName', type: 'string' },    // ✓ camelCase
    { name: 'lastName', type: 'string' },     // ✓ camelCase
    { name: 'age', type: 'int' },            // ✓ camelCase
    {
      name: 'address',                       // ✓ camelCase
      type: {
        type: 'record',
        name: 'Address',                     // ✓ PascalCase
        fields: [
          { name: 'street', type: 'string' },      // ✓ camelCase
          { name: 'city', type: 'string' }         // ✓ camelCase
        ]
      }
    },
    {
      name: 'status',                        // ✓ camelCase
      type: {
        type: 'enum',
        name: 'PersonStatus',               // ✓ PascalCase
        symbols: ['ACTIVE', 'INACTIVE', 'PENDING']  // ✓ SCREAMING_CASE
      }
    }
  ]
}
```

### Invalid Schema (Will Fail Validation with Errors)

```javascript
{
  type: 'record',
  name: 'person',                    // ✗ Should be PascalCase
  fields: [
    { name: 'FirstName', type: 'string' },   // ✗ Should be camelCase
    { name: 'age-field', type: 'int' },      // ✗ Has non-alphanumeric character
    {
      name: 'address',
      type: {
        type: 'record',
        name: 'address_details',              // ✗ Should be PascalCase
        fields: [...]
      }
    },
    {
      name: 'status',
      type: {
        type: 'enum',
        name: 'PersonStatus',
        symbols: ['active', 'INACTIVE']       // ✗ 'active' should be SCREAMING_CASE
      }
    }
  ]
}
```

## Backward Compatibility

- Sanity checks are **enabled by default** for new schemas
- Users can disable them by unchecking the option in the UI
- Existing schemas that don't follow naming conventions will fail validation unless the option is disabled
- This encourages best practices but doesn't break existing workflows

## Future Enhancements

Possible future improvements:
1. Auto-fix naming violations option
2. Configuration for strictness levels (warnings vs. errors)
3. Additional rules (e.g., field name length limits, reserved keywords)
4. Per-rule enable/disable options
5. Custom naming convention rules per project

