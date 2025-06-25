// /source/utils.ts
// Utility functions used multiple times in the code

/**
 *
 * Remove any properties where their value is set to undefined. This avoids overwriting defaults
 * in the case a user passes undefined instead of simply omitting the key.
 *
 * @param passedObject {T} - The object with the undefined properties.
 *
 * @returns {T} - The same options, but with all undefined fields omitted.
 *
 * @private
 */
export const omitUndefinedProperties = <T extends { [key: string]: any }>(
	passedOptions: T,
): T => {
	// TSC forces the `as T` instead of `const ommittedOptions: T = {}`.
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const omittedOptions = {} as T

	for (const k of Object.keys(passedOptions)) {
		const key = k as keyof T

		if (passedOptions[key] !== undefined) {
			omittedOptions[key] = passedOptions[key]
		}
	}

	return omittedOptions
}
