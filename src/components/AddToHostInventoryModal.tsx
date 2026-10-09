import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { useMemo, useState, type FC, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { usePolledK8sList } from '../hooks/usePolledK8sList';
import { InfraEnvModel } from '../models';
import type {
  AddToHostInventoryFormValues,
  HostRow,
  InfraEnvKind,
  RedfishControllerInstance,
} from '../types';
import { pickControllerCredentials } from '../utils/controllerDiscovery';
import { formatError } from '../utils/errors';
import {
  addHostToInventory,
  infraEnvKey,
  infraEnvLabel,
  isStaticNetworkComplete,
  parseInfraEnvKey,
} from '../utils/hostInventory';

interface AddToHostInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  host: HostRow | undefined;
  controller?: RedfishControllerInstance;
}

const buildInitialForm = (host: HostRow): AddToHostInventoryFormValues => ({
  infraEnvKey: '',
  name: host.name,
  hostname: host.name,
  bmcAddress: host.bmcAddress,
  bootMACAddress: host.macs[0] ?? '',
  username: '',
  password: '',
  networkMode: 'dhcp',
  staticIp: '',
  staticPrefixLength: '24',
  staticGateway: '',
  staticDns: '',
  staticInterface: 'eth0',
});

interface InventoryFormProps {
  host: HostRow;
  controller?: RedfishControllerInstance;
  onClose: () => void;
}

const InventoryForm: FC<InventoryFormProps> = ({ host, controller, onClose }) => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const [form, setForm] = useState<AddToHostInventoryFormValues>(() => buildInitialForm(host));
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const [infraEnvs, infraLoaded, infraError] = usePolledK8sList<InfraEnvKind>(InfraEnvModel, {});

  const credentials = useMemo(
    () => pickControllerCredentials(controller?.config, host.chassisName),
    [controller?.config, host.chassisName],
  );

  const sortedInfraEnvs = useMemo(
    () =>
      [...infraEnvs].sort((a, b) => {
        const aKey = infraEnvKey(a);
        const bKey = infraEnvKey(b);
        return aKey.localeCompare(bKey);
      }),
    [infraEnvs],
  );

  const effectiveInfraKey =
    form.infraEnvKey || (sortedInfraEnvs.length === 1 ? infraEnvKey(sortedInfraEnvs[0]) : '');

  const update = <K extends keyof AddToHostInventoryFormValues>(
    key: K,
    value: AddToHostInventoryFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectedInfra = useMemo(() => {
    const parsed = parseInfraEnvKey(effectiveInfraKey);
    if (!parsed) {
      return undefined;
    }
    return sortedInfraEnvs.find((ie) => {
      const ns = ie.metadata?.namespace;
      const name = ie.metadata?.name;
      return ns === parsed.namespace && name === parsed.name;
    });
  }, [effectiveInfraKey, sortedInfraEnvs]);

  const canSubmit =
    !!selectedInfra &&
    !!credentials &&
    !!form.name.trim() &&
    !!form.hostname.trim() &&
    !!form.bmcAddress.trim() &&
    !!form.bootMACAddress.trim() &&
    isStaticNetworkComplete(form) &&
    !submitting;

  const onSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!selectedInfra || !credentials || !canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    void addHostToInventory(
      {
        ...form,
        infraEnvKey: effectiveInfraKey,
        username: credentials.username,
        password: credentials.password,
      },
      selectedInfra,
    )
      .then(() => {
        onClose();
      })
      .catch((err: unknown) => {
        setError(formatError(err));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <>
      <ModalBody>
        {!infraLoaded && <Spinner aria-label={t('Loading host inventories')} />}
        {infraLoaded && infraError != null && (
          <Alert variant="danger" title={t('Failed to load host inventories')} isInline>
            {formatError(infraError)}
          </Alert>
        )}
        {infraLoaded && !infraError && !sortedInfraEnvs.length && (
          <Alert variant="warning" title={t('No host inventories found')} isInline>
            {t(
              'Create an InfraEnv (Assisted Installer / multicluster engine host inventory) before adding hosts.',
            )}
          </Alert>
        )}
        {infraLoaded && sortedInfraEnvs.length > 0 && !credentials && (
          <Alert variant="warning" title={t('BMC credentials unavailable')} isInline>
            {t(
              'No authentication users were found in the redfish-controller configuration. Add users under authentication.users.',
            )}
          </Alert>
        )}
        {infraLoaded && sortedInfraEnvs.length > 0 && (
          <Form id="add-to-host-inventory-form" onSubmit={onSubmit}>
            {error && (
              <Alert
                variant="danger"
                title={t('Failed to add host to inventory')}
                isInline
                className="pf-v6-u-mb-md"
              >
                {error}
              </Alert>
            )}
            <FormGroup label={t('Host inventory')} isRequired fieldId="inventory-infraenv">
              <select
                id="inventory-infraenv"
                className="pf-v6-c-form-control"
                value={effectiveInfraKey}
                onChange={(e) => {
                  update('infraEnvKey', e.target.value);
                }}
                disabled={sortedInfraEnvs.length === 1}
              >
                <option value="">{t('Select a host inventory')}</option>
                {sortedInfraEnvs.map((ie) => {
                  const key = infraEnvKey(ie);
                  return (
                    <option key={key} value={key}>
                      {infraEnvLabel(ie)}
                    </option>
                  );
                })}
              </select>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t('Assisted Installer InfraEnv where the BareMetalHost will be created.')}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup label={t('Name')} isRequired fieldId="inventory-name">
              <TextInput
                id="inventory-name"
                value={form.name}
                onChange={(_e, v) => {
                  setForm((prev) => {
                    const syncHostname = prev.hostname === prev.name || prev.hostname === host.name;
                    return {
                      ...prev,
                      name: v,
                      hostname: syncHostname ? v : prev.hostname,
                    };
                  });
                }}
              />
            </FormGroup>
            <FormGroup label={t('Hostname')} isRequired fieldId="inventory-hostname">
              <TextInput
                id="inventory-hostname"
                value={form.hostname}
                onChange={(_e, v) => {
                  update('hostname', v);
                }}
              />
            </FormGroup>
            <FormGroup
              label={t('Baseboard Management Controller Address')}
              isRequired
              fieldId="inventory-bmc"
            >
              <TextInput
                id="inventory-bmc"
                value={form.bmcAddress}
                onChange={(_e, v) => {
                  update('bmcAddress', v);
                }}
              />
            </FormGroup>
            <FormGroup label={t('Boot NIC MAC Address')} isRequired fieldId="inventory-mac">
              <TextInput
                id="inventory-mac"
                value={form.bootMACAddress}
                onChange={(_e, v) => {
                  update('bootMACAddress', v);
                }}
              />
            </FormGroup>
            <FormGroup label={t('Discovery network')} isRequired fieldId="inventory-network-mode">
              <Radio
                id="inventory-net-dhcp"
                name="inventory-network-mode"
                label={t('DHCP')}
                isChecked={form.networkMode === 'dhcp'}
                onChange={() => {
                  update('networkMode', 'dhcp');
                }}
              />
              <Radio
                id="inventory-net-static"
                name="inventory-network-mode"
                label={t('Static IP')}
                isChecked={form.networkMode === 'static'}
                onChange={() => {
                  update('networkMode', 'static');
                }}
                className="pf-v6-u-mt-sm"
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t(
                      'Static IP creates an NMStateConfig for discovery when DHCP is unavailable. The InfraEnv ISO is regenerated to include it.',
                    )}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            {form.networkMode === 'static' && (
              <>
                <FormGroup label={t('IPv4 address')} isRequired fieldId="inventory-static-ip">
                  <TextInput
                    id="inventory-static-ip"
                    value={form.staticIp}
                    onChange={(_e, v) => {
                      update('staticIp', v);
                    }}
                    placeholder="192.168.1.50/24"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {t('CIDR (recommended) or address with prefix length below.')}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                {!form.staticIp.includes('/') && (
                  <FormGroup
                    label={t('Prefix length')}
                    isRequired
                    fieldId="inventory-static-prefix"
                  >
                    <TextInput
                      id="inventory-static-prefix"
                      value={form.staticPrefixLength}
                      onChange={(_e, v) => {
                        update('staticPrefixLength', v);
                      }}
                      placeholder="24"
                    />
                  </FormGroup>
                )}
                <FormGroup label={t('Gateway')} isRequired fieldId="inventory-static-gateway">
                  <TextInput
                    id="inventory-static-gateway"
                    value={form.staticGateway}
                    onChange={(_e, v) => {
                      update('staticGateway', v);
                    }}
                    placeholder="192.168.1.1"
                  />
                </FormGroup>
                <FormGroup label={t('DNS servers')} fieldId="inventory-static-dns">
                  <TextInput
                    id="inventory-static-dns"
                    value={form.staticDns}
                    onChange={(_e, v) => {
                      update('staticDns', v);
                    }}
                    placeholder="192.168.1.1, 8.8.8.8"
                  />
                </FormGroup>
                <FormGroup label={t('Interface name')} fieldId="inventory-static-iface">
                  <TextInput
                    id="inventory-static-iface"
                    value={form.staticInterface}
                    onChange={(_e, v) => {
                      update('staticInterface', v);
                    }}
                    placeholder="eth0"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {t(
                          'Logical name in NMState; Assisted remaps it to the NIC with the boot MAC.',
                        )}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              </>
            )}
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="add"
          variant="primary"
          onClick={() => {
            onSubmit();
          }}
          isDisabled={!canSubmit || !sortedInfraEnvs.length}
          isLoading={submitting}
        >
          {submitting ? t('Adding...') : t('Add host')}
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </>
  );
};

const AddToHostInventoryModal: FC<AddToHostInventoryModalProps> = ({
  isOpen,
  onClose,
  host,
  controller,
}) => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const hostKey = host ? `${host.namespace}/${host.name}` : '';

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      aria-label={t('Add to host inventory')}
    >
      <ModalHeader title={t('Add to host inventory')} />
      {isOpen && host ? (
        <InventoryForm key={hostKey} host={host} controller={controller} onClose={onClose} />
      ) : null}
    </Modal>
  );
};

export default AddToHostInventoryModal;
