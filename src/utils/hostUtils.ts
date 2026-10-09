import { buildBmcAddress, generateSystemID } from './bmc';
import { matchesVMSelector } from './controllerDiscovery';
import type {
  ChassisConfig,
  HostRow,
  RedfishControllerInstance,
  VirtualMachineInstanceKind,
  VirtualMachineKind,
} from '../types';

export const getVMCpuCores = (vm: VirtualMachineKind): number | undefined => {
  const cpu = vm.spec?.template?.spec?.domain?.cpu;
  if (!cpu) {
    return undefined;
  }
  const cores = cpu.cores ?? 1;
  const sockets = cpu.sockets ?? 1;
  const threads = cpu.threads ?? 1;
  return cores * sockets * threads;
};

export const getVMMemory = (vm: VirtualMachineKind): string | undefined =>
  vm.spec?.template?.spec?.domain?.memory?.guest ??
  vm.spec?.template?.spec?.domain?.resources?.requests?.memory;

export const getVMIAddresses = (
  vmi?: VirtualMachineInstanceKind,
): { ips: string[]; macs: string[] } => {
  const ips = new Set<string>();
  const macs = new Set<string>();
  vmi?.status?.interfaces?.forEach((iface) => {
    if (iface.ipAddress) {
      ips.add(iface.ipAddress);
    }
    iface.ipAddresses?.forEach((ip) => ips.add(ip));
    if (iface.mac) {
      macs.add(iface.mac);
    }
  });

  return { ips: Array.from(ips), macs: Array.from(macs) };
};

export const getConfiguredMacs = (vm: VirtualMachineKind): string[] => {
  const macs =
    vm.spec?.template?.spec?.domain?.devices?.interfaces
      ?.map((iface) => iface.macAddress)
      .filter((mac): mac is string => !!mac) ?? [];
  return macs;
};

export const findChassisForVM = (
  controller: RedfishControllerInstance,
  namespace: string,
  vmName: string,
  labels: Record<string, string> | undefined,
): ChassisConfig | undefined => {
  const chassisInNs = (controller.config.chassis ?? []).filter((c) => c.namespace === namespace);
  return (
    chassisInNs.find((c) => matchesVMSelector(vmName, labels, c.vm_selector)) ?? chassisInNs[0]
  );
};

export const buildHostRows = (
  controller: RedfishControllerInstance | undefined,
  vms: VirtualMachineKind[],
  vmis: VirtualMachineInstanceKind[],
  options?: { enrolledOnly?: boolean },
): HostRow[] => {
  if (!controller) {
    return [];
  }

  const vmiByKey = new Map<string, VirtualMachineInstanceKind>();
  vmis.forEach((vmi) => {
    const ns = vmi.metadata?.namespace;
    const name = vmi.metadata?.name;
    if (ns && name) {
      vmiByKey.set(`${ns}/${name}`, vmi);
    }
  });

  const chassisNamespaces = new Set(
    (controller.config.chassis ?? []).map((c) => c.namespace).filter(Boolean),
  );

  const rows: HostRow[] = [];
  vms.forEach((vm) => {
    const namespace = vm.metadata?.namespace;
    const name = vm.metadata?.name;
    if (!namespace || !name || !chassisNamespaces.has(namespace)) {
      return;
    }

    const labels = vm.metadata?.labels;
    const chassis = findChassisForVM(controller, namespace, name, labels);
    const enrolled = chassis
      ? matchesVMSelector(name, labels, chassis.vm_selector)
      : matchesVMSelector(name, labels, undefined);
    const vmi = vmiByKey.get(`${namespace}/${name}`);
    const { ips, macs: runtimeMacs } = getVMIAddresses(vmi);
    const macs = runtimeMacs.length ? runtimeMacs : getConfiguredMacs(vm);
    const systemId = generateSystemID(controller.config.system_id_convention, namespace, name);

    rows.push({
      name,
      namespace,
      chassisName: chassis?.name ?? '—',
      powerStatus: vm.status?.printableStatus ?? 'Unknown',
      ready: !!vm.status?.ready,
      ips,
      macs,
      bmcAddress: buildBmcAddress(controller.routeHost, systemId),
      systemId,
      cpuCores: getVMCpuCores(vm),
      memory: getVMMemory(vm),
      enrolled,
      vm,
      vmi,
    });
  });

  return rows
    .filter((row) => (options?.enrolledOnly === false ? true : row.enrolled))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const isVMRunning = (vm: VirtualMachineKind): boolean => {
  const status = vm.status?.printableStatus?.toLowerCase() ?? '';
  if (status.includes('running') || status === 'migrating') {
    return true;
  }
  if (vm.spec?.runStrategy) {
    return vm.spec.runStrategy === 'Always' || vm.spec.runStrategy === 'RerunOnFailure';
  }
  return !!vm.spec?.running;
};
