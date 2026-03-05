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
	if (isIPv6(ip)) {
		const address = new Address6(ip)

		// First, check if the address is IPv4 mapped to IPv6 (e.g., ::ffff:x.y.z.w),
		// as is common on servers with dual-stack networks (both IPv4 and IPv6). If
		// this is the case, we extract and return the IPv4 address. Otherwise, the
		// default subnet value of 56 (or any 32 to 80 subnet) ignores the unique IP
		// address in the last two octets completely.
		if (address.is4()) return address.to4().correctForm()

		// For IPv6, return the network address of the subnet in CIDR format
		if (ipv6Subnet) {
			const subnet = new Address6(`${ip}/${ipv6Subnet}`)
			return `${subnet.startAddress().correctForm()}/${ipv6Subnet}`
		}
	}

	// For IPv4, just return the IP address itself
	return ip
}
