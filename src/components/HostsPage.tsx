import { DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  PageSection,
  Spinner,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { useHosts } from '../hooks/useHosts';
import { useRedfishController } from '../hooks/useRedfishController';
import type { ChassisConfig, HostRow } from '../types';
import { formatError, isForbiddenError } from '../utils/errors';
import { findChassisForVM } from '../utils/hostUtils';
import AddToHostInventoryModal from './AddToHostInventoryModal';
import CopyCell from './CopyCell';
import EnrollModal from './EnrollModal';
import HostActionsMenu from './HostActionsMenu';
import './hosts.css';

interface ChassisSystemsGroup {
  chassis: ChassisConfig;
  systems: HostRow[];
}

const HostsPage: FC = () => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const navigate = useNavigate();
  const {
    controllers,
    selectedController,
    selectedId,
    setSelectedId,
    loaded: controllerLoaded,
    error: controllerError,
  } = useRedfishController();

  const { hosts, vms, loaded: hostsLoaded, error: hostsError } = useHosts(selectedController, true);
  const [chassisFilter, setChassisFilter] = useState('');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [busyKey, setBusyKey] = useState<string>();
  const [inventoryHost, setInventoryHost] = useState<HostRow>();

  const filteredHosts = useMemo(
    () => (chassisFilter ? hosts.filter((h) => h.chassisName === chassisFilter) : hosts),
    [hosts, chassisFilter],
  );

  const chassisOptions = useMemo(
    () => Array.from(new Set(hosts.map((h) => h.chassisName))).sort(),
    [hosts],
  );

  const chassisGroups = useMemo((): ChassisSystemsGroup[] => {
    const configured = selectedController?.config.chassis ?? [];
    if (!configured.length) {
      return [];
    }
    return configured.map((chassis) => ({
      chassis,
      systems: hosts
        .filter((h) => h.chassisName === chassis.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [selectedController, hosts]);

  const loaded = controllerLoaded && hostsLoaded;
  const error = controllerError;

  return (
    <>
      <DocumentTitle>{t('Kubevirt Systems')}</DocumentTitle>
      <ListPageHeader title={t('Kubevirt Systems')} />
      <PageSection>
        {!loaded && <Spinner aria-label={t('Loading hosts')} />}
        {loaded && error != null && error !== false && !controllers.length && (
          <Alert
            variant={isForbiddenError(error) ? 'warning' : 'danger'}
            title={t('Failed to load data')}
            isInline
          >
            <p>{formatError(error)}</p>
            {isForbiddenError(error) && (
              <p>
                {t(
                  'Your user needs permission to list Secrets and Routes labeled app.kubernetes.io/name=kubevirt-redfish (typically cluster-admin or access to the redfish-controller namespace).',
                )}
              </p>
            )}
          </Alert>
        )}
        {loaded && !controllers.length && (error == null || error === false) && (
          <EmptyState titleText={t('No redfish-controller found')} icon={CubesIcon}>
            <EmptyStateBody>
              {t(
                'Install redfish-controller (Helm chart kubevirt-redfish) so this plugin can discover chassis configuration and BMC routes.',
              )}
            </EmptyStateBody>
          </EmptyState>
        )}
        {loaded && !!controllers.length && (
          <>
            {hostsError != null && hostsError !== false && (
              <Alert
                variant="warning"
                title={t('Failed to load VirtualMachines')}
                isInline
                className="pf-v6-u-mb-md"
              >
                {formatError(hostsError)}
              </Alert>
            )}
            {actionError && (
              <Alert variant="danger" title={t('Action failed')} isInline className="pf-v6-u-mb-md">
                {actionError}
              </Alert>
            )}
            {selectedController && (
              <Alert variant="info" isInline className="pf-v6-u-mb-md" title={t('Controller')}>
                {selectedController.id}
                {selectedController.routeHost
                  ? ` · ${t('BMC route')}: ${selectedController.routeHost}`
                  : ''}
              </Alert>
            )}

            {chassisGroups.length > 0 && (
              <div className="kubevirt-hosts__chassis-list pf-v6-u-mb-md">
                <Title headingLevel="h2" size="lg" className="pf-v6-u-mb-sm">
                  {t('Chassis and systems')}
                </Title>
                <Table aria-label={t('Chassis and systems')}>
                  <Thead>
                    <Tr>
                      <Th>{t('Chassis')}</Th>
                      <Th>{t('Namespace')}</Th>
                      <Th>{t('Systems')}</Th>
                      <Th width={10}>{t('Count')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {chassisGroups.map(({ chassis, systems }) => (
                      <Tr key={`${chassis.namespace}/${chassis.name}`}>
                        <Td dataLabel={t('Chassis')}>
                          <Button
                            variant="link"
                            isInline
                            onClick={() => {
                              setChassisFilter(chassis.name);
                            }}
                          >
                            {chassis.name}
                          </Button>
                          {chassis.description && (
                            <div className="pf-v6-u-color-200 pf-v6-u-font-size-sm">
                              {chassis.description}
                            </div>
                          )}
                        </Td>
                        <Td dataLabel={t('Namespace')}>
                          <span className="kubevirt-hosts__mono">{chassis.namespace}</span>
                        </Td>
                        <Td dataLabel={t('Systems')}>
                          {systems.length === 0 ? (
                            <span className="pf-v6-u-color-200">{t('No systems')}</span>
                          ) : (
                            <ul className="kubevirt-hosts__system-list">
                              {systems.map((host) => (
                                <li key={`${host.namespace}/${host.name}`}>
                                  <Link to={`/kubevirt-hosts/ns/${host.namespace}/vm/${host.name}`}>
                                    {host.name}
                                  </Link>
                                  <Label
                                    color={host.ready ? 'green' : 'grey'}
                                    className="pf-v6-u-ml-sm"
                                    isCompact
                                  >
                                    {host.powerStatus}
                                  </Label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                        <Td dataLabel={t('Count')}>{systems.length}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            )}

            <Toolbar>
              <ToolbarContent>
                {controllers.length > 1 && (
                  <ToolbarItem>
                    <select
                      aria-label={t('Controller')}
                      className="pf-v6-c-form-control"
                      value={selectedId}
                      onChange={(e) => {
                        setSelectedId(e.target.value);
                      }}
                    >
                      {controllers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id}
                        </option>
                      ))}
                    </select>
                  </ToolbarItem>
                )}
                {chassisOptions.length > 1 && (
                  <ToolbarItem>
                    <select
                      aria-label={t('Chassis')}
                      className="pf-v6-c-form-control"
                      value={chassisFilter}
                      onChange={(e) => {
                        setChassisFilter(e.target.value);
                      }}
                    >
                      <option value="">{t('All chassis')}</option>
                      {chassisOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </ToolbarItem>
                )}
                <ToolbarItem>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void navigate('/kubevirt-hosts/create');
                    }}
                  >
                    {t('Create host')}
                  </Button>
                </ToolbarItem>
                <ToolbarItem>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEnrollOpen(true);
                    }}
                  >
                    {t('Enroll existing')}
                  </Button>
                </ToolbarItem>
                {selectedController?.routeHost && (
                  <ToolbarItem align={{ default: 'alignEnd' }}>
                    <span className="kubevirt-hosts__mono">
                      {t('BMC route')}: {selectedController.routeHost}
                    </span>
                  </ToolbarItem>
                )}
              </ToolbarContent>
            </Toolbar>

            {!filteredHosts.length ? (
              <EmptyState titleText={t('No enrolled hosts')} icon={CubesIcon}>
                <EmptyStateBody>
                  {t(
                    'Create a KubeVirt VM labeled for Redfish, or enroll an existing VM in a chassis namespace.',
                  )}
                </EmptyStateBody>
                <EmptyStateFooter>
                  <EmptyStateActions>
                    <Button
                      variant="primary"
                      onClick={() => {
                        void navigate('/kubevirt-hosts/create');
                      }}
                    >
                      {t('Create host')}
                    </Button>
                    <Button
                      variant="link"
                      onClick={() => {
                        setEnrollOpen(true);
                      }}
                    >
                      {t('Enroll existing')}
                    </Button>
                  </EmptyStateActions>
                </EmptyStateFooter>
              </EmptyState>
            ) : (
              <Table aria-label={t('Kubevirt hosts')}>
                <Thead>
                  <Tr>
                    <Th>{t('Name')}</Th>
                    <Th>{t('Namespace / Chassis')}</Th>
                    <Th>{t('Power')}</Th>
                    <Th>{t('Guest IPs')}</Th>
                    <Th>{t('MAC')}</Th>
                    <Th>{t('BMC address')}</Th>
                    <Th>{t('CPU / Memory')}</Th>
                    <Th screenReaderText={t('Actions')} />
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredHosts.map((host) => {
                    const key = `${host.namespace}/${host.name}`;
                    const busy = busyKey === key;
                    const chassis = selectedController
                      ? findChassisForVM(
                          selectedController,
                          host.namespace,
                          host.name,
                          host.vm.metadata?.labels,
                        )
                      : undefined;
                    return (
                      <Tr key={key}>
                        <Td dataLabel={t('Name')}>
                          <Link to={`/kubevirt-hosts/ns/${host.namespace}/vm/${host.name}`}>
                            {host.name}
                          </Link>
                        </Td>
                        <Td dataLabel={t('Namespace / Chassis')}>
                          {host.namespace}
                          <br />
                          <Label color="blue">{host.chassisName}</Label>
                        </Td>
                        <Td dataLabel={t('Power')}>
                          <Label color={host.ready ? 'green' : 'grey'}>{host.powerStatus}</Label>
                        </Td>
                        <Td dataLabel={t('Guest IPs')}>
                          {host.ips.length ? host.ips.join(', ') : '—'}
                        </Td>
                        <Td dataLabel={t('MAC')}>
                          {host.macs.length ? host.macs.join(', ') : '—'}
                        </Td>
                        <Td dataLabel={t('BMC address')} className="kubevirt-hosts__bmc">
                          <CopyCell text={host.bmcAddress} />
                        </Td>
                        <Td dataLabel={t('CPU / Memory')}>
                          {host.cpuCores ?? '—'} / {host.memory ?? '—'}
                        </Td>
                        <Td isActionCell>
                          <HostActionsMenu
                            host={host}
                            chassis={chassis}
                            variant="kebab"
                            isDisabled={busy}
                            onError={(message) => {
                              setActionError(message);
                            }}
                            onBusyChange={(isBusy) => {
                              setBusyKey(isBusy ? key : undefined);
                            }}
                            onAddToInventory={setInventoryHost}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            )}

            {selectedController && (
              <EnrollModal
                isOpen={enrollOpen}
                onClose={() => {
                  setEnrollOpen(false);
                }}
                controller={selectedController}
                vms={vms}
              />
            )}
            <AddToHostInventoryModal
              isOpen={!!inventoryHost}
              host={inventoryHost}
              controller={selectedController}
              onClose={() => {
                setInventoryHost(undefined);
              }}
            />
          </>
        )}
      </PageSection>
    </>
  );
};

export default HostsPage;
