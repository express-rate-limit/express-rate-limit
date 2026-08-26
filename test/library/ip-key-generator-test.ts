import { describe, expect, it } from 'vitest'
import { ipKeyGenerator } from '../../source/index.js'

describe('ipKeyGenerator', () => {
	it('should return an IPv4 address unchanged', () => {
		expect(ipKeyGenerator('1.2.3.4')).toBe('1.2.3.4')
		expect(ipKeyGenerator('1.2.3.4', 16)).toBe('1.2.3.4')
	})

	it('should return an IPv4 address mapped to IPv6 as an IPv4 address', () => {
		expect(ipKeyGenerator('::ffff:1.2.3.4')).toBe('1.2.3.4')
		expect(ipKeyGenerator('::1.2.3.4')).toBe('1.2.3.4')
	})

	it('should return an IPv4 address mapped to IPv6 as an IPv4 address regardless of notation', () => {
		// `::ffff:102:304` and `::ffff:1.2.3.4` are one address written two ways, so
		// they have to produce one key.
		expect(ipKeyGenerator('::ffff:102:304')).toBe('1.2.3.4')
		expect(ipKeyGenerator('::ffff:102:304', 16)).toBe('1.2.3.4')
		expect(ipKeyGenerator('::ffff:102:304', false)).toBe('1.2.3.4')
		expect(ipKeyGenerator('::ffff:102:304')).toBe(
			ipKeyGenerator('::ffff:1.2.3.4'),
		)
	})

	it('should apply ipv6Subnet to an IPv6 address that merely ends in dotted-quad notation', () => {
		// These are ordinary IPv6 addresses that only look IPv4-mapped. Extracting
		// the trailing IPv4 address would key the client on the bits it controls
		// itself, and put it in the same bucket as an unrelated IPv4 client.
		expect(ipKeyGenerator('2001:db8:1234:5678::1.2.3.4')).toBe(
			'2001:db8:1234:5600::/56',
		)
		expect(ipKeyGenerator('64:ff9b::1.2.3.4')).toBe('64:ff9b::/56')
		expect(ipKeyGenerator('2001:db8:1234:5678::1.2.3.4')).toBe(
			ipKeyGenerator('2001:db8:1234:5678::102:304'),
		)
		expect(ipKeyGenerator('2001:db8::1.2.3.4')).not.toBe(
			ipKeyGenerator('1.2.3.4'),
		)
	})

	it('should apply ipv6Subnet to addresses in the IPv4-compatible range that are not written in dotted-quad notation', () => {
		expect(ipKeyGenerator('::1')).toBe('::/56')
		expect(ipKeyGenerator('::')).toBe('::/56')
	})

	it('should return an IPv6 address unchanged with ipv6Subnet set to false', () => {
		expect(
			ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef', false),
		).toBe('0123:4567:89ab:cdef:0123:4567:89ab:cdef')
	})

	it('should apply ipv6Subnet only a true IPv6 address', () => {
		expect(ipKeyGenerator('::1.2.3.4', 16)).toBe('1.2.3.4')
		expect(ipKeyGenerator('::ffff:1.2.3.4', 16)).toBe('1.2.3.4')
		expect(ipKeyGenerator('::1.2.3.4', false)).toBe('1.2.3.4')
	})

	it('should apply a default /56 netmask to an IPv6 address', () => {
		expect(ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef')).toBe(
			'123:4567:89ab:cd00::/56',
		)
	})

	it('should apply a /63 netmask to an IPv6 address', () => {
		expect(ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef', 63)).toBe(
			'123:4567:89ab:cdee::/63',
		)
	})

	it('should accept abbreviated IPv6 addresses', () => {
		expect(ipKeyGenerator('123:ABC::89')).toBe('123:abc::/56')
	})

	it('should return an IPv6 address normalized but otherwise unchanged with a /128 netmask', () => {
		expect(ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef', 128)).toBe(
			'123:4567:89ab:cdef:123:4567:89ab:cdef/128',
		)
	})
})
