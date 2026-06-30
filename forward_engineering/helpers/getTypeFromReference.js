const _ = require('lodash');
const { toPascalCaseName } = require('./generalHelper');

const getTypeFromReference = schema => {
	if (!schema.$ref) {
		return;
	}

	if (_.includes(schema.$ref, '#')) {
		const namespace = schema.namespace || '';
		const name = toPascalCaseName(_.last(schema.$ref.split('/')) || '');

		return [namespace, name].filter(Boolean).join('.');
	}

	return schema.$ref;
};

module.exports = getTypeFromReference;
