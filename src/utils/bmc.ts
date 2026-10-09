import type { SystemIDConvention } from '../types';

export const generateSystemID = (
  convention: SystemIDConvention | undefined,
  namespace: string,
  vmName: string,
): string => {
  if (convention === 'enhanced') {
    return `${namespace}.${vmName}`;
  }
  return vmName;
};

export const buildRedfishSystemPath = (systemId: string): string =>
  `/redfish/v1/Systems/${systemId}`;

export const buildBmcAddress = (routeHost: string | undefined, systemId: string): string => {
  if (!routeHost) {
    return buildRedfishSystemPath(systemId);
  }
  const host = routeHost.replace(/^https?:\/\//, '');
  return `redfish-virtualmedia+https://${host}${buildRedfishSystemPath(systemId)}`;
};
