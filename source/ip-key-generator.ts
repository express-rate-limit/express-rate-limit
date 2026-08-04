import { isIPv6 } from 'node:net'
import { Address6 } from 'ip-address'

// The deprecated IPv4-compatible range (RFC 4291, section 2.5.5.1). The
// IPv4-mapped range is recognized with `isMapped4()`, which needs no comparison
// subnet.
const ipv4CompatibleSubnet = new Address6('::/96')

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
		//
		// Whether an address is mapped has to be decided from its bits
		// (`isMapped4()`) rather than from its notation (`is4()`), because those are
		// different questions: `::ffff:1.2.3.4` and `::ffff:102:304` are one address
		// written two ways and must produce one key, while `2001:db8::1.2.3.4` is an
		// ordinary IPv6 address that merely ends in dotted-quad notation. Extracting
		// `1.2.3.4` from the latter would skip the subnet entirely and key the client
		// on the bits it controls itself, as well as put it in the same bucket as the
		// unrelated IPv4 client 1.2.3.4.
		if (
			address.isMapped4() ||
			// The deprecated IPv4-compatible notation keeps its existing behavior.
			// Its range is shared with addresses that embed no IPv4 address at all
			// (`::`, `::1`), so here the notation is what tells them apart.
			(address.is4() && address.isInSubnet(ipv4CompatibleSubnet))
		)
			return address.to4().correctForm()

		// For IPv6, return the network address of the subnet in CIDR format
		if (ipv6Subnet) {
			const subnet = new Address6(`${ip}/${ipv6Subnet}`)
			return subnet.networkForm()
		}
	}

	// For IPv4, just return the IP address itself
	return ip
}
