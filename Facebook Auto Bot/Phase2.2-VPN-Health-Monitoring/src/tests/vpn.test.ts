import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OpenVPNConfigParser } from '../vpn/openvpn/OpenVPNConfigParser';
import { WireGuardConfigGenerator } from '../vpn/wireguard/WireGuardConfigGenerator';
import { IPManager } from '../vpn/ip-manager/IPManager';

describe('VPN Manager Tests', () => {
  describe('OpenVPN Config Parser', () => {
    let parser: OpenVPNConfigParser;

    beforeEach(() => {
      parser = new OpenVPNConfigParser();
    });

    it('should parse basic OpenVPN config', () => {
      const configContent = `
        remote vpn.example.com 1194 udp
        client
        dev tun
        proto udp
        resolv-retry infinite
        nobind
        persist-key
        persist-tun
        ca ca.crt
        cert client.crt
        key client.key
        cipher AES-256-CBC
        auth SHA256
        comp-lzo
        verb 3
      `;

      const config = parser.parseConfigContent(configContent);
      
      expect(config.server).toBe('vpn.example.com');
      expect(config.port).toBe(1194);
      expect(config.protocol).toBe('udp');
      expect(config.compression).toBe(true);
    });

    it('should validate configuration', () => {
      const invalidConfig = {
        server: '',
        port: 1194,
        protocol: 'udp' as const,
      };

      const errors = parser.validateConfig(invalidConfig as any);
      expect(errors).toContain('Server address is required');
    });

    it('should generate config file', () => {
      const config = {
        server: 'vpn.example.com',
        port: 1194,
        protocol: 'udp' as const,
        caCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        clientCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        clientKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        cipher: 'AES-256-CBC',
        auth: 'SHA256',
        compression: true,
        redirectGateway: true,
        route: ['10.0.0.0 255.255.255.0'],
        dns: ['8.8.8.8', '8.8.4.4'],
      };

      const configFile = parser.generateConfigFile(config);
      expect(configFile).toContain('remote vpn.example.com 1194 udp');
      expect(configFile).toContain('cipher AES-256-CBC');
      expect(configFile).toContain('dhcp-option DNS 8.8.8.8');
    });
  });

  describe('WireGuard Config Generator', () => {
    let generator: WireGuardConfigGenerator;

    beforeEach(() => {
      generator = new WireGuardConfigGenerator();
    });

    it('should generate key pair', () => {
      const keyPair = generator.generateKeyPair();
      
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).not.toBe(keyPair.publicKey);
    });

    it('should generate configuration', () => {
      const interfaceConfig = {
        name: 'wg0',
        privateKey: 'base64privatekey',
        address: ['10.0.0.1/24'],
        dns: ['8.8.8.8'],
        mtu: 1420,
      };

      const peers = [{
        publicKey: 'base64publickey',
        endpoint: 'vpn.example.com:51820',
        allowedIPs: ['0.0.0.0/0'],
        persistentKeepalive: 25,
      }];

      const config = generator.generateConfig(interfaceConfig, peers);
      
      expect(config).toContain('[Interface]');
      expect(config).toContain('PrivateKey = base64privatekey');
      expect(config).toContain('[Peer]');
      expect(config).toContain('Endpoint = vpn.example.com:51820');
    });

    it('should validate configuration', () => {
      const config = {
        interface: {
          name: 'wg0',
          privateKey: 'invalid',
          address: ['10.0.0.1/24'],
        },
        peers: [{
          publicKey: 'publickey',
          endpoint: 'example.com:51820',
          allowedIPs: ['0.0.0.0/0'],
        }],
      };

      const errors = generator.validateConfig(config as any);
      expect(errors.length).toBe(0); // Should pass with valid config
    });
  });

  describe('IP Manager', () => {
    let ipManager: IPManager;

    beforeEach(() => {
      ipManager = new IPManager({
        strategy: 'time-based',
        interval: 300000,
      });
    });

    it('should add IP to pool', () => {
      ipManager.addIP('192.168.1.100');
      
      const pool = ipManager.getIPPool();
      expect(pool).toHaveLength(1);
      expect(pool[0].ip).toBe('192.168.1.100');
    });

    it('should select next IP based on policy', () => {
      ipManager.addIP('192.168.1.100');
      ipManager.addIP('192.168.1.101');
      ipManager.addIP('192.168.1.102');

      const nextIP = ipManager.getNextIP();
      expect(nextIP).toBeDefined();
      expect(['192.168.1.100', '192.168.1.101', '192.168.1.102']).toContain(nextIP);
    });

    it('should blacklist IP', () => {
      ipManager.addIP('192.168.1.100');
      ipManager.blacklistIP('192.168.1.100', 'Test blacklist');
      
      const blacklistedIPs = ipManager.getBlacklistedIPs();
      expect(blacklistedIPs).toContain('192.168.1.100');
    });

    it('should report IP usage', () => {
      ipManager.addIP('192.168.1.100');
      ipManager.reportUsage('192.168.1.100', 1024);
      
      const pool = ipManager.getIPPool();
      const entry = pool.find(entry => entry.ip === '192.168.1.100');
      expect(entry?.totalBytes).toBe(1024);
    });
  });
});