import { buildBmcAddress, buildRedfishSystemPath, generateSystemID } from './bmc';

describe('bmc helpers', () => {
  it('generates legacy and enhanced system IDs', () => {
    expect(generateSystemID('legacy', 'ns', 'vm1')).toBe('vm1');
    expect(generateSystemID(undefined, 'ns', 'vm1')).toBe('vm1');
    expect(generateSystemID('enhanced', 'ns', 'vm1')).toBe('ns.vm1');
  });

  it('builds BMC addresses', () => {
    expect(buildRedfishSystemPath('vm1')).toBe('/redfish/v1/Systems/vm1');
    expect(buildBmcAddress('redfish.apps.example.com', 'vm1')).toBe(
      'redfish-virtualmedia+https://redfish.apps.example.com/redfish/v1/Systems/vm1',
    );
    expect(buildBmcAddress('https://redfish.apps.example.com', 'vm1')).toBe(
      'redfish-virtualmedia+https://redfish.apps.example.com/redfish/v1/Systems/vm1',
    );
    expect(buildBmcAddress(undefined, 'vm1')).toBe('/redfish/v1/Systems/vm1');
  });
});
