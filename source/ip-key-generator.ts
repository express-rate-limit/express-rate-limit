import { isIPv6 } from 'node:net'
import { Address6 } from 'ip-address'

/**
 * Returns the IP address itself for IPv4, or a CIDR-notation subnet for IPv6.
 *
 * If you write a custom keyGenerator that allows a fallback to IP address for
 * unauthenticated users, return ipKeyGenerator(req.ip) rather than just req.ip.
 *
 * For more information, {@see Options.ipv6Subnet}.
 *
 * @param ip {string} - The IP address to process, usually request.ip.
 * @param ipv6Subnet {number | false} - The subnet mask for IPv6 addresses.
 *
 * @returns {string} - The key generated from the IP address
 *
 * @public
 */
export function ipKeyGenerator(ip: string, ipv6Subnet: number | false = 56) {
	if (ipv6Subnet && isIPv6(ip)) {
		// For IPv6, return the network address of the subnet in CIDR format
		return `${new Address6(`${ip}/${ipv6Subnet}`).startAddress().correctForm()}/${ipv6Subnet}`
	}

	// For IPv4, just return the IP address itself
	return ip
}
