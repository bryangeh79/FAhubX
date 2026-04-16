import * as crypto from 'crypto';
import * as os from 'os';

/**
 * Generate a unique machine fingerprint based on hardware identifiers.
 * Uses MAC addresses + hostname + CPU model as inputs.
 * Returns a stable SHA-256 hash that stays the same across reboots.
 */
export function getMachineId(): string {
  const parts: string[] = [];

  // Collect MAC addresses (stable across reboots)
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces).sort()) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      if (net.mac && net.mac !== '00:00:00:00:00:00') {
        parts.push(net.mac);
      }
    }
  }

  // Add hostname and CPU model for extra uniqueness
  parts.push(os.hostname());
  const cpus = os.cpus();
  if (cpus.length > 0) {
    parts.push(cpus[0].model);
  }

  // Hash all parts into a stable fingerprint
  const raw = parts.join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}
