import {
	getIpv6NetworkAddress,
	ipKeyGenerator,
} from '../../source/ip-key-generator.js'

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

	// these were written by gemini to test the code it generated
	describe('getIpv6NetworkAddress', () => {
		test('should correctly calculate the network address for a full IPv6 address', () => {
			const ip = '2001:0db8:85a3:08d3:1319:8a2e:0370:7344'
			const mask = 64
			expect(getIpv6NetworkAddress(ip, mask)).toBe('2001:db8:85a3:8d3::/64')
		})

		test('should handle compressed IPv6 addresses correctly', () => {
			const compressedIp = '2606:4700::6810:85e5'
			const mask = 120
			expect(getIpv6NetworkAddress(compressedIp, mask)).toBe(
				'2606:4700::6810:8500/120',
			)
		})

		test('should handle the localhost address (::1) with a full mask', () => {
			const localhost = '::1'
			const mask = 128
			expect(getIpv6NetworkAddress(localhost, mask)).toBe('::1/128')
		})

		test('should handle a /0 subnet mask, resulting in ::/0', () => {
			const ip = '2001:db8::1'
			const mask = 0
			expect(getIpv6NetworkAddress(ip, mask)).toBe('::/0')
		})

		test('should correctly calculate the network for an address that is all zeros', () => {
			const ip = '::'
			const mask = 64
			expect(getIpv6NetworkAddress(ip, mask)).toBe('::/64')
		})

		test('should support IPv4-mapped addresses', () => {
			const ip = '::ffff:127.0.0.1'
			const mask = 120
			expect(getIpv6NetworkAddress(ip, mask)).toBe('::ffff:7f00:0/120')
		})

		test('should throw an error for an invalid IPv6 address with multiple compressions', () => {
			const invalidIp = '2001:db8::1::2'
			const mask = 64
			expect(() => getIpv6NetworkAddress(invalidIp, mask)).toThrow(
				'Invalid IPv6 address: contains more than one "::".',
			)
		})

		test('should throw an error for an out-of-range subnet mask (too high)', () => {
			const ip = '::1'
			const invalidMask = 129
			expect(() => getIpv6NetworkAddress(ip, invalidMask)).toThrow(
				'Invalid subnet mask. Must be an integer between 0 and 128.',
			)
		})

		test('should throw an error for an out-of-range subnet mask (too low)', () => {
			const ip = '::1'
			const invalidMask = -1
			expect(() => getIpv6NetworkAddress(ip, invalidMask)).toThrow(
				'Invalid subnet mask. Must be an integer between 0 and 128.',
			)
		})
	})
})
