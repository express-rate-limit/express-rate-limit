// /test/library/helpers/strip-types.js
// A jest transformer that removes type annotations from typescript files

import { stripTypeScriptTypes } from 'node:module'

export default {
	// The stripped code has the same line and column positions as the source, so
	// no source map is required.
	process: (source) => ({ code: stripTypeScriptTypes(source) }),
}
