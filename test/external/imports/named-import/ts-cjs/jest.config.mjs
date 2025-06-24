export default {
	verbose: true,
	preset: 'ts-jest/presets/default',
	collectCoverage: true,
	testTimeout: 30000,
	testMatch: ['**/test/**/*-test.[jt]s'],
	moduleFileExtensions: ['js', 'json', 'ts'],
	moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
}
