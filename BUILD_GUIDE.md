# Building the Hackolade Avro Plugin

## Quick Start

```bash
npm run package
```

This command will:
1. Bundle all source files using esbuild
2. Minify the output
3. Copy non-code files (JSON, images, etc.)
4. Create the release package in `release/Avro-0.2.31/`

## Prerequisites

- Node.js 16 or higher
- npm 7 or higher

## Development Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run package
```

## Build Output

After running `npm run package`, the plugin will be available at:
```
release/Avro-0.2.31/
```

This folder contains:
- Bundled JavaScript files for forward/reverse engineering
- Configuration files
- Documentation and schemas
- All resources needed for the plugin

## Build Artifacts

- `release/Avro-0.2.31/forward_engineering/api.js` - Forward engineering bundled code
- `release/Avro-0.2.31/reverse_engineering/api.js` - Reverse engineering bundled code
- Other supporting files and resources

## Available Scripts

```bash
# Build the plugin
npm run package

# Lint the code
npm run lint

# Format code with Prettier
npm run format

# Check linting with type awareness
npm run lint:check
```

## Testing Before Build

Before building, you may want to run tests:

```bash
# Test sanitization helper
node forward_engineering/helpers/sanitizationHelper.test.js

# Test schema conversion
node forward_engineering/helpers/convertJsonSchemaToAvro.test.js

# Test schema validation
node forward_engineering/helpers/schemaValidator.test.js

# Test integration
node forward_engineering/helpers/sanitizationIntegration.test.js
```

## Project Structure

```
hackolade-avro/
├── forward_engineering/        # Forward engineering logic
│   ├── api.js                  # Main API entry point
│   ├── config.json             # Configuration options
│   ├── helpers/                # Helper utilities
│   │   ├── convertJsonSchemaToAvro.js
│   │   ├── sanitizationHelper.js      # [NEW] Name sanitization
│   │   ├── schemaValidator.js
│   │   ├── udtHelper.js
│   │   └── ... other helpers
│   └── ...
├── reverse_engineering/        # Reverse engineering logic
│   ├── api.js
│   └── ...
├── shared/                     # Shared utilities
├── properties_pane/            # Property panel configs
├── package.json                # npm configuration
├── esbuild.package.js          # Build script
└── ...
```

## Configuration

The plugin is configured via `forward_engineering/config.json`:

```json
{
  "extension": "avsc",
  "additionalOptions": [
    {
      "id": "sanitizeNames",
      "value": true,
      "name": "Sanitize names",
      "description": "Automatically convert record/enum names to PascalCase, fields to camelCase, and enum constants to UPPER_SNAKE_CASE"
    },
    // ... other options
  ]
}
```

## Key Files for the Sanitization Feature

The new sanitization feature includes:

1. **Core Implementation**
   - `forward_engineering/helpers/sanitizationHelper.js` - Main sanitization logic

2. **Integration Points**
   - `forward_engineering/api.js` - API configuration
   - `forward_engineering/helpers/convertJsonSchemaToAvro.js` - Integration with conversion

3. **Tests**
   - `forward_engineering/helpers/sanitizationHelper.test.js` - Unit tests (19 tests)
   - `forward_engineering/helpers/sanitizationIntegration.test.js` - Integration tests (7 tests)

4. **Configuration**
   - `forward_engineering/config.json` - "Sanitize names" option

## Build Configuration

The build is configured in `esbuild.package.js`:

```javascript
esbuild.build({
  entryPoints: [
    'api/fe.js',
    'api/re.js',
    'forward_engineering/api.js',
    'reverse_engineering/api.js',
  ],
  bundle: true,
  platform: 'node',
  target: 'node16',
  minify: true,
  outdir: RELEASE_FOLDER_PATH,
  // ... other options
})
```

## Version

Current version: **0.2.31**

Located in:
- `package.json`
- Release folder name: `Avro-0.2.31`

## Troubleshooting

### Build Fails
```bash
# Clear node_modules and reinstall
rm -r node_modules
npm install
npm run package
```

### Tests Fail
```bash
# Check Node version
node --version  # Should be 16 or higher

# Run individual tests for debugging
node forward_engineering/helpers/sanitizationHelper.test.js
```

### Lint Warnings
```bash
# Format code
npm run format

# Check lint issues
npm run lint:check
```

## Performance Notes

- Build time: ~100-130ms
- Output size: ~221kb (minified, single file)
- No external dependencies at runtime (all bundled)

## Deployment

After building:

1. The plugin is ready to use in the `release/Avro-0.2.31/` folder
2. Can be packaged as a zip file for distribution
3. Ready to install in Hackolade

## Support

For questions about:
- **Building**: See `esbuild.package.js` and `buildConstants.js`
- **Testing**: See individual test files in `helpers/` folder
- **Feature**: See `SANITIZATION_CHANGES.md` and `IMPLEMENTATION_COMPLETE.md`

## Additional Resources

- `SANITIZATION_CHANGES.md` - Detailed feature documentation
- `IMPLEMENTATION_COMPLETE.md` - Implementation summary
- `README.md` - General plugin documentation

