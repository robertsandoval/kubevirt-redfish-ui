import { load } from 'js-yaml';

import { REDFISH_CONTROLLER_APP_NAMES } from '../models';
import type {
  AuthUserConfig,
  ChassisConfig,
  RedfishControllerConfig,
  RedfishControllerInstance,
  RouteKind,
  SecretKind,
  SystemIDConvention,
  VMSelectorConfig,
} from '../types';

const decodeSecretValue = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    return atob(value);
  } catch {
    return value;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const parseVMSelector = (raw: unknown): VMSelectorConfig | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  const labels =
    isRecord(raw.labels) &&
    Object.fromEntries(
      Object.entries(raw.labels).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  const names = Array.isArray(raw.names)
    ? raw.names.filter((n): n is string => typeof n === 'string')
    : undefined;
  if (!labels && !names?.length) {
    return undefined;
  }
  return {
    labels: labels || undefined,
    names,
  };
};

const parseChassis = (raw: unknown): ChassisConfig[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(isRecord)
    .map((item) => ({
      name: asString(item.name),
      namespace: asString(item.namespace),
      service_account: typeof item.service_account === 'string' ? item.service_account : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      vm_selector: parseVMSelector(item.vm_selector),
    }))
    .filter((c) => c.name && c.namespace);
};

const parseAuthUsers = (raw: unknown): AuthUserConfig[] => {
  if (!isRecord(raw) || !Array.isArray(raw.users)) {
    return [];
  }
  return raw.users
    .filter(isRecord)
    .map((user) => ({
      username: asString(user.username),
      password: asString(user.password),
      chassis: Array.isArray(user.chassis)
        ? user.chassis.filter((c): c is string => typeof c === 'string')
        : undefined,
    }))
    .filter((user) => !!user.username && !!user.password);
};

export const parseControllerConfig = (yamlText: string): RedfishControllerConfig | null => {
  try {
    const parsed = load(yamlText);
    if (!isRecord(parsed)) {
      return null;
    }
    const convention = parsed.system_id_convention;
    const system_id_convention: SystemIDConvention | undefined =
      convention === 'legacy' || convention === 'enhanced' ? convention : undefined;
    return {
      system_id_convention: system_id_convention ?? 'legacy',
      chassis: parseChassis(parsed.chassis),
      users: parseAuthUsers(parsed.authentication),
    };
  } catch {
    return null;
  }
};

/** Prefer a user allowed for the chassis; otherwise the first configured user. */
export const pickControllerCredentials = (
  config: RedfishControllerConfig | undefined,
  chassisName?: string,
): AuthUserConfig | undefined => {
  const users = config?.users ?? [];
  if (!users.length) {
    return undefined;
  }
  if (chassisName) {
    const forChassis = users.find(
      (u) => !u.chassis?.length || u.chassis.includes(chassisName) || u.chassis.includes('*'),
    );
    if (forChassis) {
      return forChassis;
    }
  }
  return users[0];
};

export const getSecretConfigYaml = (secret: SecretKind): string | undefined => {
  if (secret.stringData?.['config.yaml']) {
    return secret.stringData['config.yaml'];
  }
  return decodeSecretValue(secret.data?.['config.yaml']);
};

export const hasRedfishControllerLabel = (resource: {
  metadata?: { labels?: Record<string, string> };
}): boolean => {
  const name = resource.metadata?.labels?.['app.kubernetes.io/name'];
  return !!name && REDFISH_CONTROLLER_APP_NAMES.includes(name);
};

export const discoverControllers = (
  secrets: SecretKind[],
  routes: RouteKind[],
): RedfishControllerInstance[] => {
  const routesByNamespace = new Map<string, RouteKind[]>();
  routes.forEach((route) => {
    const ns = route.metadata?.namespace;
    if (!ns) {
      return;
    }
    const list = routesByNamespace.get(ns) ?? [];
    list.push(route);
    routesByNamespace.set(ns, list);
  });

  const controllers: RedfishControllerInstance[] = [];

  secrets.forEach((secret) => {
    const namespace = secret.metadata?.namespace;
    const secretName = secret.metadata?.name;
    if (!namespace || !secretName) {
      return;
    }

    const yamlText = getSecretConfigYaml(secret);
    if (!yamlText) {
      return;
    }

    const config = parseControllerConfig(yamlText);
    if (!config?.chassis?.length) {
      return;
    }

    if (!hasRedfishControllerLabel(secret) && !yamlText.includes('chassis:')) {
      return;
    }

    const nsRoutes = routesByNamespace.get(namespace) ?? [];
    const routeHost =
      nsRoutes.find(hasRedfishControllerLabel)?.spec?.host ??
      nsRoutes.find((r) => {
        const routeName = r.metadata?.name ?? '';
        return routeName.includes('redfish');
      })?.spec?.host ??
      (nsRoutes.length > 0 ? nsRoutes[0].spec?.host : undefined);

    controllers.push({
      id: `${namespace}/${secretName}`,
      namespace,
      secretName,
      routeHost,
      config,
    });
  });

  return controllers.sort((a, b) => a.id.localeCompare(b.id));
};

export const defaultSelectorLabels = (chassis?: ChassisConfig): Record<string, string> =>
  chassis?.vm_selector?.labels ?? { 'redfish-enabled': 'true' };

export const matchesVMSelector = (
  vmName: string,
  labels: Record<string, string> | undefined,
  selector?: VMSelectorConfig,
): boolean => {
  if (!selector) {
    return labels?.['redfish-enabled'] === 'true';
  }

  const nameMatch = selector.names?.length ? selector.names.includes(vmName) : false;
  const labelEntries = Object.entries(selector.labels ?? {});
  const labelMatch =
    labelEntries.length > 0 ? labelEntries.every(([key, value]) => labels?.[key] === value) : false;

  if (selector.names?.length && labelEntries.length) {
    return nameMatch || labelMatch;
  }
  if (selector.names?.length) {
    return nameMatch;
  }
  if (labelEntries.length) {
    return labelMatch;
  }
  return true;
};
