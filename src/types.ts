import type { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

export type SystemIDConvention = 'legacy' | 'enhanced';

export interface VMSelectorConfig {
  labels?: Record<string, string>;
  names?: string[];
}

export interface ChassisConfig {
  name: string;
  namespace: string;
  service_account?: string;
  description?: string;
  vm_selector?: VMSelectorConfig;
}

export interface AuthUserConfig {
  username: string;
  password: string;
  chassis?: string[];
}

export interface RedfishControllerConfig {
  system_id_convention?: SystemIDConvention;
  chassis?: ChassisConfig[];
  /** First usable Redfish API user from controller config (for BMC secrets) */
  users?: AuthUserConfig[];
}

export interface RedfishControllerInstance {
  id: string;
  namespace: string;
  secretName: string;
  routeHost?: string;
  config: RedfishControllerConfig;
}

export type VirtualMachineKind = K8sResourceCommon & {
  spec?: {
    runStrategy?: string;
    running?: boolean;
    template?: {
      metadata?: {
        labels?: Record<string, string>;
      };
      spec?: {
        domain?: {
          cpu?: {
            cores?: number;
            sockets?: number;
            threads?: number;
          };
          memory?: {
            guest?: string;
          };
          devices?: {
            disks?: {
              name: string;
              bootOrder?: number;
              disk?: { bus?: string };
              cdrom?: { bus?: string };
            }[];
            interfaces?: {
              name: string;
              macAddress?: string;
              masquerade?: object;
              bridge?: object;
              sriov?: object;
            }[];
          };
          resources?: {
            requests?: {
              memory?: string;
              cpu?: string | number;
            };
          };
        };
        networks?: {
          name: string;
          pod?: object;
          multus?: { networkName: string };
        }[];
        volumes?: {
          name: string;
          dataVolume?: { name: string };
          persistentVolumeClaim?: { claimName: string };
          emptyDisk?: { capacity?: string };
          containerDisk?: { image: string };
          cloudInitNoCloud?: object;
        }[];
      };
    };
    dataVolumeTemplates?: {
      metadata?: { name?: string };
      spec?: {
        pvc?: {
          accessModes?: string[];
          resources?: { requests?: { storage?: string } };
          storageClassName?: string;
        };
        storage?: {
          accessModes?: string[];
          resources?: { requests?: { storage?: string } };
          storageClassName?: string;
        };
        source?: Record<string, unknown>;
      };
    }[];
  };
  status?: {
    printableStatus?: string;
    ready?: boolean;
  };
};

export type VirtualMachineInstanceKind = K8sResourceCommon & {
  status?: {
    phase?: string;
    interfaces?: {
      name?: string;
      interfaceName?: string;
      ipAddress?: string;
      ipAddresses?: string[];
      mac?: string;
    }[];
  };
};

export type SecretKind = K8sResourceCommon & {
  data?: Record<string, string>;
  stringData?: Record<string, string>;
};

export type RouteKind = K8sResourceCommon & {
  spec?: {
    host?: string;
    to?: { kind?: string; name?: string };
    tls?: object;
  };
};

export type NetworkAttachmentDefinitionKind = K8sResourceCommon;

export type StorageClassKind = K8sResourceCommon & {
  parameters?: Record<string, string>;
};

/** Assisted Installer host inventory */
export type InfraEnvKind = K8sResourceCommon & {
  spec?: {
    nmStateConfigLabelSelector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: unknown[];
    };
    [key: string]: unknown;
  };
};

export type BareMetalHostKind = K8sResourceCommon & {
  spec?: {
    online?: boolean;
    bootMACAddress?: string;
    bmc?: {
      address?: string;
      credentialsName?: string;
      disableCertificateVerification?: boolean;
    };
    automatedCleaningMode?: string;
    bootMode?: string;
  };
};

export type NMStateConfigKind = K8sResourceCommon & {
  spec?: {
    config?: Record<string, unknown>;
    interfaces?: { name: string; macAddress: string }[];
  };
};

export type InventoryNetworkMode = 'dhcp' | 'static';

export interface AddToHostInventoryFormValues {
  infraEnvKey: string;
  name: string;
  hostname: string;
  bmcAddress: string;
  bootMACAddress: string;
  username: string;
  password: string;
  /** Discovery networking: DHCP (default) or static via NMStateConfig. */
  networkMode: InventoryNetworkMode;
  /** IPv4 address, optionally with CIDR (e.g. 192.168.1.10/24). */
  staticIp: string;
  /** Prefix length when staticIp has no CIDR. */
  staticPrefixLength: string;
  staticGateway: string;
  /** Optional DNS servers, comma or space separated. */
  staticDns: string;
  /** Logical interface name in nmstate (Assisted remaps by MAC). */
  staticInterface: string;
}

export interface HostRow {
  name: string;
  namespace: string;
  chassisName: string;
  powerStatus: string;
  ready: boolean;
  ips: string[];
  macs: string[];
  bmcAddress: string;
  systemId: string;
  cpuCores: number | undefined;
  memory: string | undefined;
  enrolled: boolean;
  vm: VirtualMachineKind;
  vmi?: VirtualMachineInstanceKind;
}

export interface CreateHostFormValues {
  name: string;
  chassisName: string;
  namespace: string;
  description: string;
  cpuCores: number;
  memory: string;
  diskSize: string;
  storageClass: string;
  networkType: 'pod' | 'multus';
  networkName: string;
  macAddress: string;
}
