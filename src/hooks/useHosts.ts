import { useMemo } from 'react';

import { VirtualMachineInstanceModel, VirtualMachineModel } from '../models';
import type {
  HostRow,
  RedfishControllerInstance,
  VirtualMachineInstanceKind,
  VirtualMachineKind,
} from '../types';
import { buildHostRows } from '../utils/hostUtils';
import { usePolledK8sListNamespaces } from './usePolledK8sList';

export const useHosts = (
  controller: RedfishControllerInstance | undefined,
  enrolledOnly = true,
) => {
  const namespaces = useMemo(
    () =>
      Array.from(
        new Set((controller?.config.chassis ?? []).map((c) => c.namespace).filter(Boolean)),
      ),
    [controller],
  );

  const enabled = !!controller && namespaces.length > 0;

  const [vms, vmsLoaded, vmsError] = usePolledK8sListNamespaces<VirtualMachineKind>(
    VirtualMachineModel,
    namespaces,
    enabled,
  );

  const [vmis, vmisLoaded] = usePolledK8sListNamespaces<VirtualMachineInstanceKind>(
    VirtualMachineInstanceModel,
    namespaces,
    enabled,
  );

  const hosts: HostRow[] = useMemo(() => {
    if (!controller || !namespaces.length) {
      return [];
    }
    return buildHostRows(controller, vms, vmis, { enrolledOnly });
  }, [controller, namespaces, vms, vmis, enrolledOnly]);

  return {
    hosts,
    vms,
    loaded: !enabled || (vmsLoaded && vmisLoaded),
    // VMI list failures are non-fatal (halted VMs have no VMI)
    error: enabled ? vmsError : undefined,
    namespaces,
  };
};
