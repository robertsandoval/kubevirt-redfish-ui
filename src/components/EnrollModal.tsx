import {
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';
import { useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChassisConfig, RedfishControllerInstance, VirtualMachineKind } from '../types';
import { matchesVMSelector } from '../utils/controllerDiscovery';
import { findChassisForVM } from '../utils/hostUtils';
import { enrollVM } from '../utils/vmActions';

interface EnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  controller: RedfishControllerInstance;
  vms: VirtualMachineKind[];
}

const EnrollModal: FC<EnrollModalProps> = ({ isOpen, onClose, controller, vms }) => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const [selectedKey, setSelectedKey] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const candidates = useMemo(() => {
    const chassisList = controller.config.chassis ?? [];
    const nsSet = new Set(chassisList.map((c) => c.namespace));
    return vms
      .filter((vm) => {
        const ns = vm.metadata?.namespace;
        return !!ns && nsSet.has(ns);
      })
      .filter((vm) => {
        const ns = vm.metadata?.namespace ?? '';
        const name = vm.metadata?.name ?? '';
        const chassis = findChassisForVM(controller, ns, name, vm.metadata?.labels);
        return !matchesVMSelector(name, vm.metadata?.labels, chassis?.vm_selector);
      })
      .sort((a, b) => (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''));
  }, [controller, vms]);

  const onEnroll = () => {
    const vm = candidates.find((item) => {
      const ns = item.metadata?.namespace ?? '';
      const name = item.metadata?.name ?? '';
      return `${ns}/${name}` === selectedKey;
    });
    if (!vm?.metadata?.namespace || !vm.metadata.name) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    const chassis: ChassisConfig | undefined = findChassisForVM(
      controller,
      vm.metadata.namespace,
      vm.metadata.name,
      vm.metadata.labels,
    );
    void enrollVM(vm, chassis)
      .then(() => {
        setSelectedKey('');
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      aria-label={t('Enroll existing VM')}
    >
      <ModalHeader title={t('Enroll existing VM')} />
      <ModalBody>
        <p>
          {t(
            'Select a VirtualMachine in a chassis namespace. Enrollment adds the redfish selector labels so redfish-controller exposes it as a Redfish System.',
          )}
        </p>
        {error && (
          <Alert variant="danger" title={t('Enrollment failed')} isInline className="pf-v6-u-mb-md">
            {error}
          </Alert>
        )}
        {!candidates.length ? (
          <Alert variant="info" title={t('No unenrolled VMs found')} isInline>
            {t('Create a new host or ensure VMs exist in a configured chassis namespace.')}
          </Alert>
        ) : (
          <Form>
            <FormGroup label={t('VirtualMachine')} isRequired fieldId="enroll-vm">
              <select
                id="enroll-vm"
                className="pf-v6-c-form-control"
                value={selectedKey}
                onChange={(e) => {
                  setSelectedKey(e.target.value);
                }}
              >
                <option value="">{t('Select a VM')}</option>
                {candidates.map((vm) => {
                  const ns = vm.metadata?.namespace ?? '';
                  const name = vm.metadata?.name ?? '';
                  const key = `${ns}/${name}`;
                  return (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  );
                })}
              </select>
            </FormGroup>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="enroll"
          variant="primary"
          onClick={onEnroll}
          isDisabled={!selectedKey || submitting}
          isLoading={submitting}
        >
          {t('Enroll')}
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default EnrollModal;
