import {
  discoverControllers,
  matchesVMSelector,
  parseControllerConfig,
} from './controllerDiscovery';
import type { RouteKind, SecretKind } from '../types';

describe('controllerDiscovery', () => {
  const configYaml = `
system_id_convention: enhanced
chassis:
  - name: jinkit-kvm
    namespace: jinkit-kvm
    vm_selector:
      labels:
        redfish-enabled: "true"
authentication:
  users:
    - username: admin
      password: admin123
      chassis: ["*"]
`;

  it('parses controller config yaml', () => {
    const config = parseControllerConfig(configYaml);
    expect(config?.system_id_convention).toBe('enhanced');
    expect(config?.chassis).toHaveLength(1);
    expect(config?.chassis?.[0].namespace).toBe('jinkit-kvm');
    expect(config?.chassis?.[0].vm_selector?.labels?.['redfish-enabled']).toBe('true');
    expect(config?.users).toEqual([{ username: 'admin', password: 'admin123', chassis: ['*'] }]);
  });

  it('discovers controllers from secrets and routes', () => {
    const secret: SecretKind = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'kubevirt-redfish-config',
        namespace: 'jinkit-kvm',
        labels: { 'app.kubernetes.io/name': 'kubevirt-redfish' },
      },
      data: {
        'config.yaml': btoa(configYaml),
      },
    };
    const route: RouteKind = {
      apiVersion: 'route.openshift.io/v1',
      kind: 'Route',
      metadata: {
        name: 'kubevirt-redfish',
        namespace: 'jinkit-kvm',
        labels: { 'app.kubernetes.io/name': 'kubevirt-redfish' },
      },
      spec: { host: 'redfish.apps.example.com' },
    };

    const controllers = discoverControllers([secret], [route]);
    expect(controllers).toHaveLength(1);
    expect(controllers[0].routeHost).toBe('redfish.apps.example.com');
    expect(controllers[0].config.chassis?.[0].name).toBe('jinkit-kvm');
  });

  it('matches VM selectors', () => {
    expect(
      matchesVMSelector(
        'vm1',
        { 'redfish-enabled': 'true' },
        {
          labels: { 'redfish-enabled': 'true' },
        },
      ),
    ).toBe(true);
    expect(matchesVMSelector('vm1', {}, { labels: { 'redfish-enabled': 'true' } })).toBe(false);
    expect(matchesVMSelector('vm1', {}, { names: ['vm1'] })).toBe(true);
  });
});
