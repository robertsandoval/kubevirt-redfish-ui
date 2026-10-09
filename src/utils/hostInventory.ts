import { k8sCreate, k8sDelete, k8sPatch } from '@openshift-console/dynamic-plugin-sdk';

import { BareMetalHostModel, InfraEnvModel, NMStateConfigModel, SecretModel } from '../models';
import type {
  AddToHostInventoryFormValues,
  BareMetalHostKind,
  InfraEnvKind,
  NMStateConfigKind,
  SecretKind,
} from '../types';

export const infraEnvKey = (infra: InfraEnvKind): string =>
  `${infra.metadata?.namespace ?? ''}/${infra.metadata?.name ?? ''}`;

/** Display label: name only when namespace matches name; otherwise "name (namespace)". */
export const infraEnvLabel = (infra: InfraEnvKind): string => {
  const name = infra.metadata?.name ?? '';
  const ns = infra.metadata?.namespace ?? '';
  if (!name) {
    return ns;
  }
  if (!ns || ns === name) {
    return name;
  }
  return `${name} (${ns})`;
};

export const parseInfraEnvKey = (key: string): { namespace: string; name: string } | undefined => {
  const idx = key.indexOf('/');
  if (idx <= 0 || idx === key.length - 1) {
    return undefined;
  }
  return { namespace: key.slice(0, idx), name: key.slice(idx + 1) };
};

export const bmcSecretName = (hostName: string): string => `${hostName}-bmc-secret`;

export const nmStateConfigName = (hostName: string): string => `${hostName}-nmstate`;

/** Default label used when InfraEnv has no nmStateConfigLabelSelector yet. */
export const defaultNmStateLabelKey = 'infraenvs.agent-install.openshift.io';

const IPV4_RE = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const parseIpv4Cidr = (
  ipOrCidr: string,
  fallbackPrefix: string,
): { ip: string; prefixLength: number } => {
  const trimmed = ipOrCidr.trim();
  const slash = trimmed.indexOf('/');
  let ip: string;
  let prefixLength: number;
  if (slash > 0) {
    ip = trimmed.slice(0, slash).trim();
    prefixLength = Number.parseInt(trimmed.slice(slash + 1).trim(), 10);
  } else {
    ip = trimmed;
    prefixLength = Number.parseInt(fallbackPrefix.trim(), 10);
  }
  if (
    !IPV4_RE.test(ip) ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 1 ||
    prefixLength > 32
  ) {
    throw new Error('Invalid IPv4 address or prefix length (use e.g. 192.168.1.10/24)');
  }
  return { ip, prefixLength };
};

export const parseDnsServers = (dns: string): string[] =>
  dns
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Labels that must appear on NMStateConfig so the InfraEnv selects them.
 * Reuses an existing selector when present; otherwise a default keyed by InfraEnv name.
 */
export const nmStateLabelsForInfraEnv = (infraEnv: InfraEnvKind): Record<string, string> => {
  const matchLabels = infraEnv.spec?.nmStateConfigLabelSelector?.matchLabels;
  if (matchLabels && Object.keys(matchLabels).length > 0) {
    return { ...matchLabels };
  }
  const name = infraEnv.metadata?.name;
  if (!name) {
    throw new Error('InfraEnv is missing name');
  }
  return { [defaultNmStateLabelKey]: name };
};

export const buildNmStateConfigSpec = (
  values: AddToHostInventoryFormValues,
): {
  config: Record<string, unknown>;
  interfaces: { name: string; macAddress: string }[];
} => {
  const iface = values.staticInterface.trim() || 'eth0';
  const mac = values.bootMACAddress.trim();
  const gateway = values.staticGateway.trim();
  if (!mac) {
    throw new Error('Boot MAC address is required for static networking');
  }
  if (!gateway) {
    throw new Error('Gateway is required for static networking');
  }

  const { ip, prefixLength } = parseIpv4Cidr(values.staticIp, values.staticPrefixLength);
  const dnsServers = parseDnsServers(values.staticDns);

  const config: Record<string, unknown> = {
    interfaces: [
      {
        name: iface,
        type: 'ethernet',
        state: 'up',
        'mac-address': mac,
        ipv4: {
          enabled: true,
          dhcp: false,
          address: [{ ip, 'prefix-length': prefixLength }],
        },
        ipv6: {
          enabled: false,
        },
      },
    ],
    routes: {
      config: [
        {
          destination: '0.0.0.0/0',
          'next-hop-address': gateway,
          'next-hop-interface': iface,
          'table-id': 254,
        },
      ],
    },
  };

  if (dnsServers.length > 0) {
    config['dns-resolver'] = {
      config: {
        server: dnsServers,
      },
    };
  }

  return {
    config,
    interfaces: [{ name: iface, macAddress: mac }],
  };
};

export const isStaticNetworkComplete = (values: AddToHostInventoryFormValues): boolean => {
  if (values.networkMode !== 'static') {
    return true;
  }
  try {
    parseIpv4Cidr(values.staticIp, values.staticPrefixLength || '24');
  } catch {
    return false;
  }
  return !!values.staticGateway.trim() && !!values.bootMACAddress.trim();
};

/**
 * Ensure InfraEnv selects NMStateConfigs. DHCP-only inventories often have an empty
 * selector; Assisted ignores unlabeled configs until a selector is set.
 */
export const ensureInfraEnvNmStateSelector = async (
  infraEnv: InfraEnvKind,
  labels: Record<string, string>,
): Promise<InfraEnvKind> => {
  const existing = infraEnv.spec?.nmStateConfigLabelSelector?.matchLabels;
  if (existing && Object.keys(existing).length > 0) {
    return infraEnv;
  }

  const hasSelectorObject = infraEnv.spec?.nmStateConfigLabelSelector != null;
  return k8sPatch<InfraEnvKind>({
    model: InfraEnvModel,
    resource: infraEnv,
    data: [
      {
        op: hasSelectorObject ? 'replace' : 'add',
        path: '/spec/nmStateConfigLabelSelector',
        value: { matchLabels: labels },
      },
    ],
  });
};

/**
 * Create BMC Secret + BareMetalHost (+ optional NMStateConfig) in an InfraEnv namespace.
 */
export const addHostToInventory = async (
  values: AddToHostInventoryFormValues,
  infraEnv: InfraEnvKind,
): Promise<{
  secret: SecretKind;
  bareMetalHost: BareMetalHostKind;
  nmStateConfig?: NMStateConfigKind;
}> => {
  const ns = infraEnv.metadata?.namespace;
  const infraName = infraEnv.metadata?.name;
  if (!ns || !infraName) {
    throw new Error('InfraEnv is missing namespace or name');
  }

  const name = values.name.trim();
  const hostname = values.hostname.trim() || name;
  const secretName = bmcSecretName(name);
  const useStatic = values.networkMode === 'static';

  let nmLabels: Record<string, string> | undefined;
  if (useStatic) {
    nmLabels = nmStateLabelsForInfraEnv(infraEnv);
    await ensureInfraEnvNmStateSelector(infraEnv, nmLabels);
  }

  const secret = await k8sCreate<SecretKind>({
    model: SecretModel,
    data: {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: secretName,
        namespace: ns,
        labels: {
          'environment.metal3.io': 'baremetal',
        },
      },
      type: 'Opaque',
      stringData: {
        username: values.username,
        password: values.password,
      },
    },
  });

  let nmStateConfig: NMStateConfigKind | undefined;
  try {
    if (useStatic && nmLabels) {
      const { config, interfaces } = buildNmStateConfigSpec(values);
      nmStateConfig = await k8sCreate<NMStateConfigKind>({
        model: NMStateConfigModel,
        data: {
          apiVersion: 'agent-install.openshift.io/v1beta1',
          kind: 'NMStateConfig',
          metadata: {
            name: nmStateConfigName(name),
            namespace: ns,
            labels: nmLabels,
          },
          spec: {
            config,
            interfaces,
          },
        },
      });
    }

    const bareMetalHost = await k8sCreate<BareMetalHostKind>({
      model: BareMetalHostModel,
      data: {
        apiVersion: 'metal3.io/v1alpha1',
        kind: 'BareMetalHost',
        metadata: {
          name,
          namespace: ns,
          labels: {
            'infraenvs.agent-install.openshift.io': infraName,
          },
          annotations: {
            'bmac.agent-install.openshift.io/hostname': hostname,
            'inspect.metal3.io': 'disabled',
          },
        },
        spec: {
          online: true,
          bootMACAddress: values.bootMACAddress.trim(),
          bmc: {
            address: values.bmcAddress.trim(),
            credentialsName: secretName,
            disableCertificateVerification: true,
          },
          // Virtual Redfish BMCs cannot complete Ironic metadata cleaning; it
          // leaves BMHs stuck in deprovisioning/clean wait on delete.
          automatedCleaningMode: 'disabled',
          bootMode: 'UEFI',
        },
      },
    });
    return { secret, bareMetalHost, nmStateConfig };
  } catch (err) {
    // Best-effort cleanup so a failed create does not leave orphans
    if (nmStateConfig) {
      try {
        await k8sDelete({ model: NMStateConfigModel, resource: nmStateConfig });
      } catch {
        // ignore cleanup errors
      }
    }
    try {
      await k8sDelete({ model: SecretModel, resource: secret });
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
};
