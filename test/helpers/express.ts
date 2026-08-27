// /test/helpers/express.ts
// Exports the version of express the tests should run against, based on the
// `EXPRESS_VERSION` environment variable set by the vitest projects.

import process from 'node:process'
import express5 from 'express'
// @ts-expect-error - aliased to `express@4`, which does not ship types.
import express4 from 'express4'

export const expressVersion = process.env.EXPRESS_VERSION === '4' ? 4 : 5

export const express = (
	expressVersion === 4 ? express4 : express5
) as typeof express5
