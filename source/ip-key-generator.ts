import { isIPv6 } from 'node:net'
import iptools from 'ip'

/**
 * Returns the IP address itself for IPv4, or a CIDR-notation subnet for IPv6 (e.g. '1234:abcd::/64')
 *
 * If you write a custom keyGenerator that allows a fallback to IP address for unauthenticated users, return ipKeyGenerator(req.ip) rather than just req.ip.
 *
 * See [Options.ipv6Subnet] for more info.
 *
 * @param ip request.ip
 * @param [ipv6Subnet=64] subnet mask for IPv6 addresses
 */
export function ipKeyGenerator(ip: string, ipv6Subnet: number | false = 56) {
	if (ipv6Subnet && isIPv6(ip)) {
		// For IPv6, return the network address of the subnet in CIDR format
		return `${iptools.mask(
			ip,
			iptools.fromPrefixLen(ipv6Subnet),
		)}/${ipv6Subnet}`
	}

	// For IPv4, just return the IP address itself
	return ip
}
