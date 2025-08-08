import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from '@jest/globals'

describe('types tests', () => {
	// apparently jest compiles this to cjs and dosn't fixup import.meta.dirname, so just use __dirname global here
	const TYPES_PATH = path.join(__dirname, '../../dist/index.d.ts')
	const TYPES_EXIST = fs.existsSync(TYPES_PATH)
	const IS_CI = !!process.env.CI

	// automatically skip the test if running locally and the types don't exist
	// always run in CI so that it will fail if the types location changes
	const maybeTest = TYPES_EXIST || IS_CI ? it : it.skip

	// see https://github.com/express-rate-limit/express-rate-limit/issues/530
	// note: this is a very dumb test and should probably be replaced by something that tries to *use* the types
	maybeTest(
		'should not have Request renamed to Request$1 in the types',
		async () => {
			const source = fs.readFileSync(TYPES_PATH).toString()
			expect(source).toEqual(expect.not.stringContaining('Request$1'))
		},
	)
})
