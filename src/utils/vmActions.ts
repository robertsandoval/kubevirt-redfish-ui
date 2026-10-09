import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';

import { VirtualMachineModel } from '../models';
import type { ChassisConfig, VirtualMachineKind } from '../types';
import { defaultSelectorLabels } from './controllerDiscovery';

const escapeJsonPointer = (token: string): string => token.replace(/~/g, '~0').replace(/\//g, '~1');

export const enrollVM = async (
  vm: VirtualMachineKind,
  chassis?: ChassisConfig,
): Promise<VirtualMachineKind> => {
  const labels = defaultSelectorLabels(chassis);
  const existing = vm.metadata?.labels ?? {};

  if (!vm.metadata?.labels) {
    return k8sPatch({
      model: VirtualMachineModel,
      resource: vm,
      data: [{ op: 'add', path: '/metadata/labels', value: labels }],
    });
  }

  const patches = Object.entries(labels).map(([key, value]) => {
    const path = `/metadata/labels/${escapeJsonPointer(key)}`;
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      return { op: 'replace', path, value };
    }
    return { op: 'add', path, value };
  });

  return k8sPatch({
    model: VirtualMachineModel,
    resource: vm,
    data: patches,
  });
};

export const unenrollVM = async (
  vm: VirtualMachineKind,
  chassis?: ChassisConfig,
): Promise<VirtualMachineKind> => {
  const labels = defaultSelectorLabels(chassis);
  const existing = vm.metadata?.labels ?? {};
  const patches = Object.keys(labels)
    .filter((key) => Object.prototype.hasOwnProperty.call(existing, key))
    .map((key) => ({
      op: 'remove',
      path: `/metadata/labels/${escapeJsonPointer(key)}`,
    }));

  if (!patches.length) {
    return vm;
  }

  return k8sPatch({
    model: VirtualMachineModel,
    resource: vm,
    data: patches,
  });
};

export const setVMRunStrategy = async (
  vm: VirtualMachineKind,
  runStrategy: 'Always' | 'Halted',
): Promise<VirtualMachineKind> => {
  if (vm.spec?.runStrategy !== undefined) {
    return k8sPatch({
      model: VirtualMachineModel,
      resource: vm,
      data: [{ op: 'replace', path: '/spec/runStrategy', value: runStrategy }],
    });
  }

  if (vm.spec && Object.prototype.hasOwnProperty.call(vm.spec, 'running')) {
    return k8sPatch({
      model: VirtualMachineModel,
      resource: vm,
      data: [{ op: 'replace', path: '/spec/running', value: runStrategy === 'Always' }],
    });
  }

  return k8sPatch({
    model: VirtualMachineModel,
    resource: vm,
    data: [{ op: 'add', path: '/spec/runStrategy', value: runStrategy }],
  });
};
