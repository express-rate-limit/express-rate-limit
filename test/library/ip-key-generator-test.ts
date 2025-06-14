import { ipKeyGenerator } from '../../source/index.js'

describe('ipKeyGenerator', () => {
	it('should return an IPv4 address unchanged', () => {
		expect(ipKeyGenerator('1.2.3.4')).toBe('1.2.3.4')
		expect(ipKeyGenerator('1.2.3.4', 16)).toBe('1.2.3.4')
	})

	it('should return an IPv6 address unchanged with ipv6Subnet set to false', () => {
		expect(
			ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef', false),
		).toBe('0123:4567:89ab:cdef:0123:4567:89ab:cdef')
	})

	it('should apply a default /64 netmask to an IPv6 address', () => {
		expect(ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef')).toBe(
			'123:4567:89ab:cdef::/64',
		)
	})

	it('should apply a /63 netmask to an IPv6 address', () => {
		expect(ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef', 63)).toBe(
			'123:4567:89ab:cdee::/63',
		)
	})

	it('should accept abbreviated IPv6 addresses', () => {
		expect(ipKeyGenerator('123:ABC::89')).toBe('123:abc::/64')
	})

	it('should return an IPv6 address normalized but otherwise unchanged with a /128 netmask', () => {
		expect(ipKeyGenerator('0123:4567:89ab:cdef:0123:4567:89ab:cdef', 128)).toBe(
			'123:4567:89ab:cdef:123:4567:89ab:cdef/128',
		)
	})
})
