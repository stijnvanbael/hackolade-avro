# Plugin Changes: Replace Sanity Checks with Automatic Sanitization

## Overview

The plugin has been updated to replace the "Enable naming sanity checks" option with an automatic "Sanitize names" feature. Instead of validating and failing when naming conventions are not met, the plugin now automatically fixes naming issues during schema conversion.

## Changes Made

### 1. Configuration Update (`forward_engineering/config.json`)

**Before:**
```json
{
  "id": "enableSanityChecks",
  "value": true,
  "name": "Enable naming sanity checks",
  "description": "Verify records/enums are PascalCase, fields are camelCase, enum constants are SCREAMING_CASE"
}
```

**After:**
```json
{
  "id": "sanitizeNames",
  "value": true,
  "name": "Sanitize names",
  "description": "Automatically convert record/enum names to PascalCase, fields to camelCase, and enum constants to UPPER_SNAKE_CASE"
}
```

### 2. New Sanitization Helper (`forward_engineering/helpers/sanitizationHelper.js`)

A new helper module that provides functions to automatically fix naming conventions:

- `toUpperSnakeCaseName(name)`: Converts strings to UPPER_SNAKE_CASE for enum constants
- `sanitizeTypeName(name)`: Converts type names to PascalCase (for records, enums, fixed)
- `sanitizeFieldName(name)`: Converts field names to camelCase
- `sanitizeEnumConstant(symbol)`: Converts enum constants to UPPER_SNAKE_CASE
- `sanitizeSchema(schema)`: Recursively sanitizes entire schemas

All functions:
- Strip non-alphanumeric characters (keeping underscores only for legitimate use)
- Intelligently split and rejoin names to handle camelCase, snake_case, PascalCase, and mixed formats
- Handle nested structures (arrays, maps, unions, records, etc.)

### 3. API Updates (`forward_engineering/api.js`)

Updated all references from `enableSanityChecks` to `sanitizeNames`:

- Renamed `getSanityChecksEnabled()` to `getSanitizeNamesEnabled()`
- Updated all function parameters
- Updated all function calls

### 4. Conversion Logic Updates (`forward_engineering/helpers/convertJsonSchemaToAvro.js`)

- Imported sanitization helper
- Added sanitization step at the end of `convertSchema()` function when `sanitizeNames` is enabled
- Sanitization is applied after all type conversions to ensure clean names

## How It Works

### Sanitization Process

When a schema is converted and sanitization is enabled:

1. **Record/Fixed Names**: Converted to PascalCase
   - `my_record` → `MyRecord`
   - `my-record` → `MyRecord`
   - `myRecord` → `MyRecord`

2. **Enum Names**: Converted to PascalCase
   - `my_enum` → `MyEnum`
   - `my-enum` → `MyEnum`

3. **Enum Constants/Symbols**: Converted to UPPER_SNAKE_CASE
   - `mySymbol` → `MY_SYMBOL`
   - `my-symbol` → `MY_SYMBOL`
   - `mySymbol123` → `MY_SYMBOL_123`

4. **Field Names**: Converted to camelCase
   - `MyField` → `myField`
   - `my_field` → `myField`
   - `MY-FIELD` → `myField`

### Special Character Handling

All non-alphanumeric characters (except underscores) are removed during sanitization:
- `field@name` → `fieldName`
- `field.name` → `fieldName`
- `field-name` → `fieldName`
- `field name` → `fieldName`

### Recursive Sanitization

The sanitization works recursively through:
- Record fields
- Array items
- Map values
- Union types
- Nested records and enums

## Benefits

1. **No Plugin Crashes**: Invalid names are automatically fixed instead of causing errors
2. **Consistent Output**: All generated schemas follow Avro naming conventions
3. **User-Friendly**: Users don't need to worry about exact naming conventions in Hackolade
4. **Backward Compatible**: The option is enabled by default but can be disabled if needed
5. **Handles Edge Cases**: Works with special characters, mixed casing, and complex nested structures

## Example

### Input Schema (with problematic names)
```json
{
  "type": "record",
  "name": "metering-config_lifecycle",
  "fields": [
    {
      "name": "EnrichedTypeOfConnection",
      "type": "enum",
      "name": "enriched_typeOfConnection",
      "symbols": ["connected", "disconnected"]
    },
    {
      "name": "DEVICE_ID",
      "type": "string"
    }
  ]
}
```

### Output Schema (with sanitized names)
```json
{
  "type": "record",
  "name": "MeteringConfigLifecycle",
  "fields": [
    {
      "name": "enrichedTypeOfConnection",
      "type": {
        "type": "enum",
        "name": "EnrichedTypeOfConnection",
        "symbols": ["CONNECTED", "DISCONNECTED"]
      }
    },
    {
      "name": "deviceId",
      "type": "string"
    }
  ]
}
```

## Tests

Two new test files have been created:

1. **`sanitizationHelper.test.js`**: Tests all sanitization functions
   - Enum constant conversion tests
   - Type name sanitization tests
   - Field name sanitization tests
   - Schema sanitization tests
   - Special character handling
   - Recursive sanitization tests

2. **Existing tests**: All existing tests in `convertJsonSchemaToAvro.test.js` continue to pass

To run the tests:
```bash
node forward_engineering/helpers/sanitizationHelper.test.js
node forward_engineering/helpers/convertJsonSchemaToAvro.test.js
```

## Backward Compatibility

- The old `validateSchemaOrThrow` function is still available for backward compatibility but is no longer called during normal conversion
- Users can disable sanitization by setting `sanitizeNames: false` if they want to keep original names
- The sanitization is opt-out (enabled by default) but can be controlled via the plugin configuration

## Building the Plugin

To build the plugin after these changes:

```bash
npm run package
```

The build command bundles all files (including the new sanitization helper) into the release folder.

## Configuration

The sanitization behavior can be controlled via:

1. **Plugin Configuration UI**: Toggle "Sanitize names" checkbox (on by default)
2. **CLI Options**: Use `sanitizeNames: true/false` in additional options
3. **Environment**: Via programmatic API with the `sanitizeNames` option

## Future Enhancements

Possible improvements:
- Add option for different naming conventions (e.g., kebab-case for fields)
- Add logging/reporting of what was sanitized
- Add validation mode that reports what would be changed without applying changes
- Add configuration for specific rules per entity type

