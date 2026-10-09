import { defaultSelectorLabels } from './controllerDiscovery';
import type { ChassisConfig, CreateHostFormValues, VirtualMachineKind } from '../types';

interface VMInterface {
  name: string;
  macAddress?: string;
  masquerade?: object;
  bridge?: object;
}

export const buildVirtualMachineManifest = (
  values: CreateHostFormValues,
  chassis?: ChassisConfig,
): VirtualMachineKind => {
  const labels = {
    ...defaultSelectorLabels(chassis),
    'kubevirt.io/domain': values.name,
  };

  const diskName = 'rootdisk';
  const cdromName = 'cdrom0';
  const dataVolumeName = `${values.name}-rootdisk`;
  const networkName = 'default';

  const useMultus = values.networkType === 'multus' && values.networkName.trim().length > 0;

  const iface: VMInterface = useMultus
    ? {
        name: networkName,
        bridge: {},
        ...(values.macAddress.trim() ? { macAddress: values.macAddress.trim() } : {}),
      }
    : {
        name: networkName,
        masquerade: {},
        ...(values.macAddress.trim() ? { macAddress: values.macAddress.trim() } : {}),
      };

  const network = useMultus
    ? {
        name: networkName,
        multus: { networkName: values.networkName.trim() },
      }
    : {
        name: networkName,
        pod: {},
      };

  const storageSpec: {
    accessModes: string[];
    resources: { requests: { storage: string } };
    storageClassName?: string;
  } = {
    accessModes: ['ReadWriteOnce'],
    resources: {
      requests: {
        storage: values.diskSize.trim() || '100Gi',
      },
    },
  };
  if (values.storageClass.trim()) {
    storageSpec.storageClassName = values.storageClass.trim();
  }

  return {
    apiVersion: 'kubevirt.io/v1',
    kind: 'VirtualMachine',
    metadata: {
      name: values.name,
      namespace: values.namespace,
      labels,
      ...(values.description
        ? { annotations: { 'openshift.io/description': values.description } }
        : {}),
    },
    spec: {
      runStrategy: 'Halted',
      dataVolumeTemplates: [
        {
          metadata: {
            name: dataVolumeName,
          },
          spec: {
            source: {
              blank: {},
            },
            storage: storageSpec,
          },
        },
      ],
      template: {
        metadata: {
          labels,
        },
        spec: {
          domain: {
            cpu: {
              cores: values.cpuCores || 8,
            },
            memory: {
              guest: values.memory.trim() || '32Gi',
            },
            devices: {
              // cdrom0 first with bootOrder 1 so redfish-controller InsertVirtualMedia
              // (which updates the volume but keeps an existing disk entry) boots ISO first.
              disks: [
                {
                  name: cdromName,
                  bootOrder: 1,
                  cdrom: {
                    bus: 'sata',
                  },
                },
                {
                  name: diskName,
                  bootOrder: 2,
                  disk: {
                    bus: 'virtio',
                  },
                },
              ],
              interfaces: [iface],
            },
          },
          networks: [network],
          volumes: [
            {
              // Placeholder until redfish-controller replaces this with the ISO PVC
              name: cdromName,
              emptyDisk: {
                capacity: '10Mi',
              },
            },
            {
              name: diskName,
              dataVolume: {
                name: dataVolumeName,
              },
            },
          ],
        },
      },
    },
  };
};

export const defaultCreateHostValues = (chassis?: ChassisConfig): CreateHostFormValues => ({
  name: '',
  chassisName: chassis?.name ?? '',
  namespace: chassis?.namespace ?? '',
  description: '',
  cpuCores: 8,
  memory: '32Gi',
  diskSize: '100Gi',
  storageClass: '',
  networkType: 'pod',
  networkName: '',
  macAddress: '',
});
