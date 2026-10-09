import {
  buildNmStateConfigSpec,
  defaultNmStateLabelKey,
  isStaticNetworkComplete,
  nmStateLabelsForInfraEnv,
  parseDnsServers,
  parseIpv4Cidr,
} from './hostInventory';
import type { AddToHostInventoryFormValues, InfraEnvKind } from '../types';

const baseValues = (): AddToHostInventoryFormValues => ({
  infraEnvKey: 'vbm-lab/vbm-lab',
  name: 'vbmh1',
  hostname: 'vbmh1',
  bmcAddress: 'redfish-virtualmedia+https://example/redfish/v1/Systems/vbmh1',
  bootMACAddress: '02:3f:94:51:19:ab',
  username: 'admin',
  password: 'admin123',
  networkMode: 'static',
  staticIp: '192.168.1.50/24',
  staticPrefixLength: '24',
  staticGateway: '192.168.1.1',
  staticDns: '192.168.1.1, 8.8.8.8',
  staticInterface: 'eth0',
});

describe('hostInventory nmstate helpers', () => {
  it('parses CIDR and plain IP with prefix', () => {
    expect(parseIpv4Cidr('10.0.0.5/23', '24')).toEqual({ ip: '10.0.0.5', prefixLength: 23 });
    expect(parseIpv4Cidr('10.0.0.5', '24')).toEqual({ ip: '10.0.0.5', prefixLength: 24 });
  });

  it('rejects invalid prefix', () => {
    expect(() => parseIpv4Cidr('10.0.0.5/99', '24')).toThrow();
    expect(() => parseIpv4Cidr('10.0.0.5', '')).toThrow();
  });

  it('parses DNS servers', () => {
    expect(parseDnsServers('1.1.1.1,8.8.8.8 9.9.9.9')).toEqual(['1.1.1.1', '8.8.8.8', '9.9.9.9']);
  });

  it('uses existing InfraEnv nmstate selector labels', () => {
    const infra: InfraEnvKind = {
      apiVersion: 'agent-install.openshift.io/v1beta1',
      kind: 'InfraEnv',
      metadata: { name: 'vbm-lab', namespace: 'vbm-lab' },
      spec: {
        nmStateConfigLabelSelector: {
          matchLabels: { 'custom-nmstate': 'yes' },
        },
      },
    };
    expect(nmStateLabelsForInfraEnv(infra)).toEqual({ 'custom-nmstate': 'yes' });
  });

  it('defaults nmstate labels from InfraEnv name', () => {
    const infra: InfraEnvKind = {
      apiVersion: 'agent-install.openshift.io/v1beta1',
      kind: 'InfraEnv',
      metadata: { name: 'vbm-lab', namespace: 'vbm-lab' },
      spec: {},
    };
    expect(nmStateLabelsForInfraEnv(infra)).toEqual({ [defaultNmStateLabelKey]: 'vbm-lab' });
  });

  it('builds nmstate config with static IPv4 and DNS', () => {
    const { config, interfaces } = buildNmStateConfigSpec(baseValues());
    expect(interfaces).toEqual([{ name: 'eth0', macAddress: '02:3f:94:51:19:ab' }]);
    expect(config).toMatchObject({
      interfaces: [
        {
          name: 'eth0',
          type: 'ethernet',
          state: 'up',
          'mac-address': '02:3f:94:51:19:ab',
          ipv4: {
            enabled: true,
            dhcp: false,
            address: [{ ip: '192.168.1.50', 'prefix-length': 24 }],
          },
        },
      ],
      routes: {
        config: [
          {
            destination: '0.0.0.0/0',
            'next-hop-address': '192.168.1.1',
            'next-hop-interface': 'eth0',
          },
        ],
      },
      'dns-resolver': {
        config: { server: ['192.168.1.1', '8.8.8.8'] },
      },
    });
  });

  it('validates static network completeness', () => {
    expect(isStaticNetworkComplete(baseValues())).toBe(true);
    expect(isStaticNetworkComplete({ ...baseValues(), networkMode: 'dhcp' })).toBe(true);
    expect(isStaticNetworkComplete({ ...baseValues(), staticGateway: '' })).toBe(false);
    expect(isStaticNetworkComplete({ ...baseValues(), staticIp: 'not-an-ip' })).toBe(false);
  });
});
