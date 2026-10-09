import { DocumentTitle, ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  PageSection,
  Spinner,
  Tab,
  TabTitleText,
  Tabs,
  Title,
} from '@patternfly/react-core';
import { useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { useHosts } from '../hooks/useHosts';
import { useRedfishController } from '../hooks/useRedfishController';
import { VirtualMachineGVK } from '../models';
import type { HostRow } from '../types';
import { buildRedfishSystemPath } from '../utils/bmc';
import { formatError } from '../utils/errors';
import { findChassisForVM, isVMRunning } from '../utils/hostUtils';
import { setVMRunStrategy } from '../utils/vmActions';
import AddToHostInventoryModal from './AddToHostInventoryModal';
import HostActionsMenu from './HostActionsMenu';
import CopyCell from './CopyCell';
import './hosts.css';

type DetailTab = 'details' | 'network' | 'hardware' | 'redfish';

const HostDetailPage: FC = () => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const params = useParams();
  const ns = typeof params.ns === 'string' ? params.ns : '';
  const name = typeof params.name === 'string' ? params.name : '';
  const {
    selectedController,
    loaded: controllerLoaded,
    error: controllerError,
  } = useRedfishController();
  const { hosts, loaded: hostsLoaded, error: hostsError } = useHosts(selectedController, false);
  const [actionError, setActionError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [inventoryHost, setInventoryHost] = useState<HostRow>();

  const host = useMemo(
    () => hosts.find((h) => h.namespace === ns && h.name === name),
    [hosts, ns, name],
  );

  const loaded = controllerLoaded && hostsLoaded;
  const error = host ? undefined : (controllerError ?? hostsError);

  const runAction = (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(undefined);
    void action()
      .catch((err: unknown) => {
        setActionError(formatError(err));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const chassis =
    selectedController && host
      ? findChassisForVM(selectedController, host.namespace, host.name, host.vm.metadata?.labels)
      : undefined;

  const diskNames =
    host?.vm.spec?.template?.spec?.domain?.devices?.disks?.map((d) => d.name).join(', ') ?? '—';

  return (
    <>
      <DocumentTitle>
        {name ? `${name} · ${t('Kubevirt Systems')}` : t('Kubevirt Systems')}
      </DocumentTitle>
      <PageSection>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to="/kubevirt-hosts">{t('Kubevirt Systems')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{name}</BreadcrumbItem>
        </Breadcrumb>
        {host && (
          <Flex
            className="pf-v6-u-mt-md"
            justifyContent={{ default: 'justifyContentSpaceBetween' }}
            alignItems={{ default: 'alignItemsCenter' }}
            flexWrap={{ default: 'wrap' }}
          >
            <FlexItem>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsMd' }}
              >
                <FlexItem>
                  <Title headingLevel="h1">{name}</Title>
                </FlexItem>
                <FlexItem>
                  <Label color={host.ready ? 'green' : 'grey'}>{host.powerStatus}</Label>
                </FlexItem>
                <FlexItem>
                  <ResourceLink
                    groupVersionKind={VirtualMachineGVK}
                    name={host.name}
                    namespace={host.namespace}
                  />
                </FlexItem>
              </Flex>
            </FlexItem>
            <FlexItem>
              <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                <FlexItem>
                  <Button
                    variant="primary"
                    isDisabled={busy}
                    onClick={() => {
                      runAction(() =>
                        setVMRunStrategy(host.vm, isVMRunning(host.vm) ? 'Halted' : 'Always'),
                      );
                    }}
                  >
                    {isVMRunning(host.vm) ? t('Stop') : t('Start')}
                  </Button>
                </FlexItem>
                <FlexItem>
                  <HostActionsMenu
                    host={host}
                    chassis={chassis}
                    variant="actions"
                    isDisabled={busy}
                    showViewDetails={false}
                    showPowerAction={false}
                    onError={setActionError}
                    onBusyChange={setBusy}
                    onAddToInventory={setInventoryHost}
                  />
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
        )}
        {!host && (
          <Title headingLevel="h1" className="pf-v6-u-mt-md">
            {name}
          </Title>
        )}
      </PageSection>
      <PageSection>
        {!loaded && <Spinner aria-label={t('Loading host')} />}
        {loaded && error != null && error !== false && (
          <Alert variant="danger" title={t('Failed to load data')} isInline>
            {formatError(error)}
          </Alert>
        )}
        {loaded && (error == null || error === false) && !host && (
          <Alert variant="warning" title={t('Host not found')} isInline>
            {t(
              'No VirtualMachine named {{name}} was found in namespace {{ns}} for the selected controller.',
              {
                name,
                ns,
              },
            )}
          </Alert>
        )}
        {loaded && (error == null || error === false) && host && (
          <>
            {actionError && (
              <Alert variant="danger" title={t('Action failed')} isInline className="pf-v6-u-mb-md">
                {actionError}
              </Alert>
            )}
            <Tabs
              activeKey={activeTab}
              onSelect={(_e, key) => {
                setActiveTab(key as DetailTab);
              }}
              aria-label={t('Host details')}
            >
              <Tab eventKey="details" title={<TabTitleText>{t('Details')}</TabTitleText>}>
                <DescriptionList isHorizontal className="pf-v6-u-mt-lg">
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Namespace')}</DescriptionListTerm>
                    <DescriptionListDescription>{host.namespace}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Chassis')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Label color="blue">{host.chassisName}</Label>
                      {chassis?.description ? ` — ${chassis.description}` : null}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Power')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Label color={host.ready ? 'green' : 'grey'}>{host.powerStatus}</Label>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Enrolled')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {host.enrolled ? t('Yes') : t('No')}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('BMC address')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <CopyCell text={host.bmcAddress} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </Tab>
              <Tab eventKey="network" title={<TabTitleText>{t('Network')}</TabTitleText>}>
                <DescriptionList isHorizontal className="pf-v6-u-mt-lg">
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Guest IPs')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {host.ips.length ? host.ips.join(', ') : '—'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('MAC addresses')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {host.macs.length ? host.macs.join(', ') : '—'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </Tab>
              <Tab eventKey="hardware" title={<TabTitleText>{t('Hardware')}</TabTitleText>}>
                <DescriptionList isHorizontal className="pf-v6-u-mt-lg">
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('CPU cores')}</DescriptionListTerm>
                    <DescriptionListDescription>{host.cpuCores ?? '—'}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Memory')}</DescriptionListTerm>
                    <DescriptionListDescription>{host.memory ?? '—'}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Disks')}</DescriptionListTerm>
                    <DescriptionListDescription>{diskNames}</DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </Tab>
              <Tab eventKey="redfish" title={<TabTitleText>{t('Redfish')}</TabTitleText>}>
                <DescriptionList isHorizontal className="pf-v6-u-mt-lg">
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('System ID')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <span className="kubevirt-hosts__mono">{host.systemId}</span>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('ID convention')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {selectedController?.config.system_id_convention ?? 'legacy'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('System path')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <span className="kubevirt-hosts__mono">
                        {buildRedfishSystemPath(host.systemId)}
                      </span>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Controller')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {selectedController?.id ?? '—'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </Tab>
            </Tabs>
          </>
        )}
      </PageSection>
      <AddToHostInventoryModal
        isOpen={!!inventoryHost}
        host={inventoryHost}
        controller={selectedController}
        onClose={() => {
          setInventoryHost(undefined);
        }}
      />
    </>
  );
};

export default HostDetailPage;
