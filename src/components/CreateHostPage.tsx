import { DocumentTitle, k8sCreate } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  NumberInput,
  PageSection,
  Radio,
  Spinner,
  TextArea,
  TextInput,
  Title,
  Wizard,
  WizardStep,
} from '@patternfly/react-core';
import { useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { usePolledK8sList, usePolledK8sListNamespaces } from '../hooks/usePolledK8sList';
import { useRedfishController } from '../hooks/useRedfishController';
import {
  NetworkAttachmentDefinitionModel,
  StorageClassModel,
  VirtualMachineModel,
} from '../models';
import type {
  CreateHostFormValues,
  NetworkAttachmentDefinitionKind,
  StorageClassKind,
} from '../types';
import { buildBmcAddress, generateSystemID } from '../utils/bmc';
import { formatError } from '../utils/errors';
import { buildVirtualMachineManifest, defaultCreateHostValues } from '../utils/vmManifest';
import './hosts.css';

/** Cluster-scoped CUDNs materialize NADs in the default namespace. */
const CUDN_NAD_NAMESPACE = 'default';

const CreateHostPage: FC = () => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const navigate = useNavigate();
  const {
    selectedController,
    loaded: controllerLoaded,
    error: controllerError,
  } = useRedfishController();

  const chassisOptions = useMemo(
    () => selectedController?.config.chassis ?? [],
    [selectedController],
  );
  /** Prefer kubevirt-chassis (name or namespace); otherwise first configured chassis */
  const defaultChassis = useMemo(() => {
    if (!chassisOptions.length) {
      return undefined;
    }
    return (
      chassisOptions.find((c) => c.name === 'kubevirt-chassis') ??
      chassisOptions.find((c) => c.namespace === 'kubevirt-chassis') ??
      chassisOptions[0]
    );
  }, [chassisOptions]);

  const [values, setValues] = useState<CreateHostFormValues>(() =>
    defaultCreateHostValues(defaultChassis),
  );
  const [seededChassisKey, setSeededChassisKey] = useState(
    defaultChassis ? `${defaultChassis.name}:${defaultChassis.namespace}` : '',
  );
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const chassisKey = defaultChassis ? `${defaultChassis.name}:${defaultChassis.namespace}` : '';
  if (defaultChassis && chassisKey !== seededChassisKey && !values.namespace) {
    setSeededChassisKey(chassisKey);
    setValues(defaultCreateHostValues(defaultChassis));
  }

  const nadNamespaces = useMemo(() => {
    const namespaces = new Set<string>([CUDN_NAD_NAMESPACE]);
    if (values.namespace) {
      namespaces.add(values.namespace);
    }
    return Array.from(namespaces);
  }, [values.namespace]);

  const [nads, nadsLoaded] = usePolledK8sListNamespaces<NetworkAttachmentDefinitionKind>(
    NetworkAttachmentDefinitionModel,
    nadNamespaces,
    nadNamespaces.length > 0,
  );

  const nadOptions = useMemo(() => {
    const seen = new Set<string>();
    return nads
      .map((nad) => {
        const nadName = nad.metadata?.name ?? '';
        const nadNs = nad.metadata?.namespace ?? '';
        if (!nadName || !nadNs) {
          return undefined;
        }
        const full = `${nadNs}/${nadName}`;
        if (seen.has(full)) {
          return undefined;
        }
        seen.add(full);
        return { full, nadNs, nadName };
      })
      .filter((opt): opt is { full: string; nadNs: string; nadName: string } => !!opt)
      .sort((a, b) => {
        // Prefer default (CUDN) networks, then chassis-local, then alpha
        if (a.nadNs === CUDN_NAD_NAMESPACE && b.nadNs !== CUDN_NAD_NAMESPACE) {
          return -1;
        }
        if (b.nadNs === CUDN_NAD_NAMESPACE && a.nadNs !== CUDN_NAD_NAMESPACE) {
          return 1;
        }
        return a.full.localeCompare(b.full);
      });
  }, [nads]);

  const [storageClasses, scLoaded] = usePolledK8sList<StorageClassKind>(StorageClassModel, {});

  const update = <K extends keyof CreateHostFormValues>(key: K, value: CreateHostFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'chassisName' && typeof value === 'string') {
        const chassis = chassisOptions.find((c) => c.name === value);
        if (chassis) {
          next.namespace = chassis.namespace;
        }
      }
      return next;
    });
  };

  const manifest = useMemo(() => {
    const chassis = chassisOptions.find((c) => c.name === values.chassisName);
    return buildVirtualMachineManifest(values, chassis);
  }, [values, chassisOptions]);

  const bmcPreview = useMemo(() => {
    if (!values.name || !values.namespace || !selectedController) {
      return '';
    }
    const systemId = generateSystemID(
      selectedController.config.system_id_convention,
      values.namespace,
      values.name,
    );
    return buildBmcAddress(selectedController.routeHost, systemId);
  }, [values.name, values.namespace, selectedController]);

  const basicsValid =
    !!values.name.trim() &&
    !!values.chassisName &&
    !!values.namespace &&
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(values.name.trim());

  const computeValid = values.cpuCores > 0 && !!values.memory.trim() && !!values.diskSize.trim();

  const networkValid = values.networkType !== 'multus' || !!values.networkName.trim();

  const onCreate = () => {
    setSubmitting(true);
    setFormError(undefined);
    void k8sCreate({
      model: VirtualMachineModel,
      data: manifest,
    })
      .then(() => {
        void navigate(`/kubevirt-hosts/ns/${values.namespace}/vm/${values.name}`);
      })
      .catch((err: unknown) => {
        setFormError(formatError(err));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  if (!controllerLoaded) {
    return (
      <PageSection>
        <Spinner aria-label={t('Loading')} />
      </PageSection>
    );
  }

  if (controllerError != null && controllerError !== false) {
    return (
      <PageSection>
        <Alert variant="danger" title={t('Controller required')} isInline>
          {formatError(controllerError)}
        </Alert>
        <Link to="/kubevirt-hosts">{t('Back to hosts')}</Link>
      </PageSection>
    );
  }

  if (!selectedController) {
    return (
      <PageSection>
        <Alert variant="danger" title={t('Controller required')} isInline>
          {t('Install and configure redfish-controller before creating hosts.')}
        </Alert>
        <Link to="/kubevirt-hosts">{t('Back to hosts')}</Link>
      </PageSection>
    );
  }

  return (
    <>
      <DocumentTitle>{t('Create host')}</DocumentTitle>
      <PageSection>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to="/kubevirt-hosts">{t('Kubevirt Systems')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{t('Create host')}</BreadcrumbItem>
        </Breadcrumb>
        <Title headingLevel="h1" className="pf-v6-u-mt-md">
          {t('Create host')}
        </Title>
      </PageSection>
      <PageSection>
        {formError && (
          <Alert
            variant="danger"
            title={t('Failed to create host')}
            isInline
            className="pf-v6-u-mb-md"
          >
            {formError}
          </Alert>
        )}
        <Wizard
          height={600}
          title={t('Create host')}
          onClose={() => {
            void navigate('/kubevirt-hosts');
          }}
          onSave={onCreate}
          footer={{
            nextButtonText: t('Next'),
            backButtonText: t('Back'),
            cancelButtonText: t('Cancel'),
          }}
        >
          <WizardStep
            id="basics"
            name={t('Basics')}
            footer={{
              isNextDisabled: !basicsValid,
            }}
          >
            <Form>
              <FormGroup label={t('Name')} isRequired fieldId="host-name">
                <TextInput
                  id="host-name"
                  value={values.name}
                  onChange={(_e, v) => {
                    update('name', v);
                  }}
                  validated={values.name && !basicsValid ? 'error' : 'default'}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      {t('DNS-1123 subdomain name (lowercase alphanumeric and dashes).')}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label={t('Chassis')} isRequired fieldId="host-chassis">
                <select
                  id="host-chassis"
                  className="pf-v6-c-form-control"
                  value={values.chassisName}
                  onChange={(e) => {
                    update('chassisName', e.target.value);
                  }}
                >
                  {chassisOptions.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.namespace})
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label={t('Namespace')} fieldId="host-namespace">
                <TextInput id="host-namespace" value={values.namespace} isDisabled />
              </FormGroup>
              <FormGroup label={t('Description')} fieldId="host-description">
                <TextInput
                  id="host-description"
                  value={values.description}
                  onChange={(_e, v) => {
                    update('description', v);
                  }}
                />
              </FormGroup>
            </Form>
          </WizardStep>

          <WizardStep
            id="compute"
            name={t('Compute & disk')}
            footer={{ isNextDisabled: !computeValid }}
          >
            <Form>
              <FormGroup label={t('CPU cores')} isRequired fieldId="host-cpu">
                <NumberInput
                  value={values.cpuCores}
                  min={1}
                  onMinus={() => {
                    update('cpuCores', Math.max(1, values.cpuCores - 1));
                  }}
                  onPlus={() => {
                    update('cpuCores', values.cpuCores + 1);
                  }}
                  onChange={(e) => {
                    const n = Number((e.target as HTMLInputElement).value);
                    if (!Number.isNaN(n)) {
                      update('cpuCores', Math.max(1, n));
                    }
                  }}
                  inputName="cpu-cores"
                  inputAriaLabel={t('CPU cores')}
                />
              </FormGroup>
              <FormGroup label={t('Memory')} isRequired fieldId="host-memory">
                <TextInput
                  id="host-memory"
                  value={values.memory}
                  onChange={(_e, v) => {
                    update('memory', v);
                  }}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Example: 32Gi')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label={t('Root disk size')} isRequired fieldId="host-disk">
                <TextInput
                  id="host-disk"
                  value={values.diskSize}
                  onChange={(_e, v) => {
                    update('diskSize', v);
                  }}
                />
              </FormGroup>
              <FormGroup label={t('Storage class')} fieldId="host-sc">
                <select
                  id="host-sc"
                  className="pf-v6-c-form-control"
                  value={values.storageClass}
                  onChange={(e) => {
                    update('storageClass', e.target.value);
                  }}
                  disabled={!scLoaded}
                >
                  <option value="">{t('Cluster default')}</option>
                  {storageClasses.map((sc) => (
                    <option key={sc.metadata?.name} value={sc.metadata?.name}>
                      {sc.metadata?.name}
                    </option>
                  ))}
                </select>
              </FormGroup>
            </Form>
          </WizardStep>

          <WizardStep id="network" name={t('Network')} footer={{ isNextDisabled: !networkValid }}>
            <Form>
              <FormGroup label={t('Network type')} isRequired fieldId="host-net-type">
                <Radio
                  id="net-pod"
                  name="network-type"
                  label={t('Pod network')}
                  isChecked={values.networkType === 'pod'}
                  onChange={() => {
                    update('networkType', 'pod');
                  }}
                />
                <Radio
                  id="net-multus"
                  name="network-type"
                  label={t('Multus NetworkAttachmentDefinition')}
                  isChecked={values.networkType === 'multus'}
                  onChange={() => {
                    update('networkType', 'multus');
                  }}
                  className="pf-v6-u-mt-sm"
                />
              </FormGroup>
              {values.networkType === 'multus' && (
                <FormGroup label={t('NetworkAttachmentDefinition')} isRequired fieldId="host-nad">
                  <select
                    id="host-nad"
                    className="pf-v6-c-form-control"
                    value={values.networkName}
                    onChange={(e) => {
                      update('networkName', e.target.value);
                    }}
                    disabled={!nadsLoaded}
                  >
                    <option value="">{t('Select a network')}</option>
                    {nadOptions.map(({ full }) => (
                      <option key={full} value={full}>
                        {full}
                      </option>
                    ))}
                  </select>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {t(
                          'Lists NADs from the chassis namespace and default (cluster-scoped CUDNs). You can also type namespace/name.',
                        )}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                  <TextInput
                    className="pf-v6-u-mt-sm"
                    aria-label={t('Custom NAD name')}
                    value={values.networkName}
                    onChange={(_e, v) => {
                      update('networkName', v);
                    }}
                    placeholder="default/vlan3"
                  />
                </FormGroup>
              )}
              <FormGroup label={t('Boot MAC address')} fieldId="host-mac">
                <TextInput
                  id="host-mac"
                  value={values.macAddress}
                  onChange={(_e, v) => {
                    update('macAddress', v);
                  }}
                  placeholder="02:00:00:00:00:01"
                />
              </FormGroup>
            </Form>
          </WizardStep>

          <WizardStep
            id="review"
            name={t('Review')}
            footer={{
              nextButtonText: submitting ? t('Creating...') : t('Create'),
              isNextDisabled: submitting || !basicsValid || !computeValid || !networkValid,
            }}
          >
            <Alert
              variant="info"
              title={t('VM will be created Halted')}
              isInline
              className="pf-v6-u-mb-md"
            >
              {t(
                'The VirtualMachine is created with runStrategy Halted and redfish selector labels so redfish-controller can expose it immediately.',
              )}
            </Alert>
            {bmcPreview && (
              <FormGroup label={t('BMC address preview')} className="pf-v6-u-mb-md">
                <p className="kubevirt-hosts__mono">{bmcPreview}</p>
              </FormGroup>
            )}
            <FormGroup label={t('Manifest')}>
              <TextArea
                aria-label={t('Manifest')}
                value={JSON.stringify(manifest, null, 2)}
                readOnly
                rows={20}
                resizeOrientation="vertical"
              />
            </FormGroup>
          </WizardStep>
        </Wizard>
      </PageSection>
    </>
  );
};

export default CreateHostPage;
