import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  type MenuToggleElement,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useState, type FC, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import type { ChassisConfig, HostRow } from '../types';
import { formatError } from '../utils/errors';
import { isVMRunning } from '../utils/hostUtils';
import { enrollVM, setVMRunStrategy, unenrollVM } from '../utils/vmActions';

interface HostActionsMenuProps {
  host: HostRow;
  chassis?: ChassisConfig;
  /** Table kebab (plain ⋮) or detail-page Actions dropdown */
  variant: 'kebab' | 'actions';
  isDisabled?: boolean;
  showViewDetails?: boolean;
  /** When false, Start/Stop is omitted (e.g. detail page has a primary power button) */
  showPowerAction?: boolean;
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onAddToInventory: (host: HostRow) => void;
}

const HostActionsMenu: FC<HostActionsMenuProps> = ({
  host,
  chassis,
  variant,
  isDisabled,
  showViewDetails = true,
  showPowerAction = true,
  onError,
  onBusyChange,
  onAddToInventory,
}) => {
  const { t } = useTranslation('plugin__kubevirt-hosts');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const disabled = Boolean(isDisabled) || busy;

  const run = (action: () => Promise<unknown>) => {
    setOpen(false);
    setBusy(true);
    onBusyChange?.(true);
    void action()
      .catch((err: unknown) => {
        onError?.(formatError(err));
      })
      .finally(() => {
        setBusy(false);
        onBusyChange?.(false);
      });
  };

  const running = isVMRunning(host.vm);

  return (
    <Dropdown
      isOpen={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
      }}
      onSelect={() => {
        setOpen(false);
      }}
      popperProps={{ position: 'right' }}
      toggle={(toggleRef: RefObject<MenuToggleElement>) =>
        variant === 'kebab' ? (
          <MenuToggle
            ref={toggleRef}
            aria-label={t('Actions')}
            variant="plain"
            isExpanded={open}
            isDisabled={disabled}
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            <EllipsisVIcon />
          </MenuToggle>
        ) : (
          <MenuToggle
            ref={toggleRef}
            isExpanded={open}
            isDisabled={disabled}
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            {t('Actions')}
          </MenuToggle>
        )
      }
    >
      <DropdownList>
        {showViewDetails && (
          <DropdownItem
            value="view"
            key="view"
            onClick={() => {
              void navigate(`/kubevirt-hosts/ns/${host.namespace}/vm/${host.name}`);
            }}
          >
            {t('View details')}
          </DropdownItem>
        )}
        {showPowerAction && (
          <DropdownItem
            value="power"
            key="power"
            onClick={() => {
              run(() => setVMRunStrategy(host.vm, running ? 'Halted' : 'Always'));
            }}
          >
            {running ? t('Stop') : t('Start')}
          </DropdownItem>
        )}
        {host.enrolled ? (
          <DropdownItem
            value="unenroll"
            key="unenroll"
            isDanger
            onClick={() => {
              run(() => unenrollVM(host.vm, chassis));
            }}
          >
            {t('Unenroll')}
          </DropdownItem>
        ) : (
          <DropdownItem
            value="enroll"
            key="enroll"
            onClick={() => {
              run(() => enrollVM(host.vm, chassis));
            }}
          >
            {t('Enroll')}
          </DropdownItem>
        )}
        <DropdownItem
          value="inventory"
          key="inventory"
          onClick={() => {
            setOpen(false);
            onAddToInventory(host);
          }}
        >
          {t('Add to host inventory')}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

export default HostActionsMenu;
