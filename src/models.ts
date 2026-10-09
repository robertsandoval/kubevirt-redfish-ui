import type { K8sModel } from '@openshift-console/dynamic-plugin-sdk';

export const VirtualMachineModel: K8sModel = {
  apiGroup: 'kubevirt.io',
  apiVersion: 'v1',
  kind: 'VirtualMachine',
  plural: 'virtualmachines',
  abbr: 'VM',
  label: 'VirtualMachine',
  labelPlural: 'VirtualMachines',
  namespaced: true,
  crd: true,
  id: 'virtualmachine',
};

export const VirtualMachineInstanceModel: K8sModel = {
  apiGroup: 'kubevirt.io',
  apiVersion: 'v1',
  kind: 'VirtualMachineInstance',
  plural: 'virtualmachineinstances',
  abbr: 'VMI',
  label: 'VirtualMachineInstance',
  labelPlural: 'VirtualMachineInstances',
  namespaced: true,
  crd: true,
  id: 'virtualmachineinstance',
};

export const SecretModel: K8sModel = {
  apiVersion: 'v1',
  kind: 'Secret',
  plural: 'secrets',
  abbr: 'S',
  label: 'Secret',
  labelPlural: 'Secrets',
  namespaced: true,
  id: 'secret',
};

export const RouteModel: K8sModel = {
  apiGroup: 'route.openshift.io',
  apiVersion: 'v1',
  kind: 'Route',
  plural: 'routes',
  abbr: 'RT',
  label: 'Route',
  labelPlural: 'Routes',
  namespaced: true,
  crd: true,
  id: 'route',
};

export const NetworkAttachmentDefinitionModel: K8sModel = {
  apiGroup: 'k8s.cni.cncf.io',
  apiVersion: 'v1',
  kind: 'NetworkAttachmentDefinition',
  plural: 'network-attachment-definitions',
  abbr: 'NAD',
  label: 'NetworkAttachmentDefinition',
  labelPlural: 'NetworkAttachmentDefinitions',
  namespaced: true,
  crd: true,
  id: 'networkattachmentdefinition',
};

export const StorageClassModel: K8sModel = {
  apiGroup: 'storage.k8s.io',
  apiVersion: 'v1',
  kind: 'StorageClass',
  plural: 'storageclasses',
  abbr: 'SC',
  label: 'StorageClass',
  labelPlural: 'StorageClasses',
  namespaced: false,
  id: 'storageclass',
};

/** Assisted Installer / MCE host inventory */
export const InfraEnvModel: K8sModel = {
  apiGroup: 'agent-install.openshift.io',
  apiVersion: 'v1beta1',
  kind: 'InfraEnv',
  plural: 'infraenvs',
  abbr: 'IE',
  label: 'InfraEnv',
  labelPlural: 'InfraEnvs',
  namespaced: true,
  crd: true,
  id: 'infraenv',
};

export const BareMetalHostModel: K8sModel = {
  apiGroup: 'metal3.io',
  apiVersion: 'v1alpha1',
  kind: 'BareMetalHost',
  plural: 'baremetalhosts',
  abbr: 'BMH',
  label: 'BareMetalHost',
  labelPlural: 'BareMetalHosts',
  namespaced: true,
  crd: true,
  id: 'baremetalhost',
};

export const NMStateConfigModel: K8sModel = {
  apiGroup: 'agent-install.openshift.io',
  apiVersion: 'v1beta1',
  kind: 'NMStateConfig',
  plural: 'nmstateconfigs',
  abbr: 'NMSC',
  label: 'NMStateConfig',
  labelPlural: 'NMStateConfigs',
  namespaced: true,
  crd: true,
  id: 'nmstateconfig',
};

export const VirtualMachineGVK = {
  group: 'kubevirt.io',
  version: 'v1',
  kind: 'VirtualMachine',
};

export const VirtualMachineInstanceGVK = {
  group: 'kubevirt.io',
  version: 'v1',
  kind: 'VirtualMachineInstance',
};

/** Core API: omit group or use empty string */
export const SecretGVK = {
  group: '',
  version: 'v1',
  kind: 'Secret',
};

export const RouteGVK = {
  group: 'route.openshift.io',
  version: 'v1',
  kind: 'Route',
};

export const NetworkAttachmentDefinitionGVK = {
  group: 'k8s.cni.cncf.io',
  version: 'v1',
  kind: 'NetworkAttachmentDefinition',
};

export const StorageClassGVK = {
  group: 'storage.k8s.io',
  version: 'v1',
  kind: 'StorageClass',
};

export const InfraEnvGVK = {
  group: 'agent-install.openshift.io',
  version: 'v1beta1',
  kind: 'InfraEnv',
};

export const BareMetalHostGVK = {
  group: 'metal3.io',
  version: 'v1alpha1',
  kind: 'BareMetalHost',
};

export const NMStateConfigGVK = {
  group: 'agent-install.openshift.io',
  version: 'v1beta1',
  kind: 'NMStateConfig',
};

/** Helm chart app.kubernetes.io/name values used by redfish-controller */
export const REDFISH_CONTROLLER_APP_NAMES = ['kubevirt-redfish', 'redfish-controller'];

export const REDFISH_CONTROLLER_LABEL_SELECTOR =
  'app.kubernetes.io/name in (kubevirt-redfish,redfish-controller)';
