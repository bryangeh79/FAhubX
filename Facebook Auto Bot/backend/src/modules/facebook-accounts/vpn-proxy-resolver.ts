import * as path from 'path';

export interface ProxyConfig {
  proxyServer: string; // e.g. "http://host:port" or "socks5://host:port"
  credentials: { username: string; password: string } | null;
}

/**
 * Converts a VpnConfig database record into Puppeteer proxy arguments.
 * Uses the VPN server as an HTTP/SOCKS proxy rather than a real OS-level VPN connection.
 */
export function resolveVpnProxy(vpnConfig: any): ProxyConfig | null {
  if (!vpnConfig) return null;

  const server = vpnConfig.server || vpnConfig.endpoint || '';
  const port = vpnConfig.port || 1080;
  const protocol = (vpnConfig.protocol || vpnConfig.type || 'openvpn').toLowerCase();
  const username = vpnConfig.username || '';
  const password = vpnConfig.password || '';

  if (!server) return null;

  let proxyServer: string;
  let credentials: { username: string; password: string } | null = null;

  if (protocol === 'wireguard') {
    // WireGuard endpoint — use as SOCKS5, embed credentials in URL
    if (username && password) {
      proxyServer = `socks5://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}:${port}`;
    } else {
      proxyServer = `socks5://${server}:${port}`;
    }
  } else {
    // OpenVPN, proxy, ikev2, l2tp, etc. — use as HTTP proxy
    proxyServer = `http://${server}:${port}`;
    if (username && password) {
      credentials = { username, password };
    }
  }

  return { proxyServer, credentials };
}
