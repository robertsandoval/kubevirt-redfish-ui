import { useMemo, useState } from 'react';

import { RouteModel, SecretModel } from '../models';
import type { RedfishControllerInstance, RouteKind, SecretKind } from '../types';
import { discoverControllers } from '../utils/controllerDiscovery';
import { usePolledK8sList } from './usePolledK8sList';

export const useRedfishController = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const [secrets, secretsLoaded, secretsError] = usePolledK8sList<SecretKind>(SecretModel, {
    labelSelector: { matchLabels: { 'app.kubernetes.io/name': 'kubevirt-redfish' } },
  });

  const [secretsAlt, secretsAltLoaded, secretsAltError] = usePolledK8sList<SecretKind>(
    SecretModel,
    { labelSelector: { matchLabels: { 'app.kubernetes.io/name': 'redfish-controller' } } },
  );

  const [routes, routesLoaded, routesError] = usePolledK8sList<RouteKind>(RouteModel, {
    labelSelector: { matchLabels: { 'app.kubernetes.io/name': 'kubevirt-redfish' } },
  });

  const [routesAlt, routesAltLoaded, routesAltError] = usePolledK8sList<RouteKind>(RouteModel, {
    labelSelector: { matchLabels: { 'app.kubernetes.io/name': 'redfish-controller' } },
  });

  const allSecrets = useMemo(() => {
    const byId = new Map<string, SecretKind>();
    [...secrets, ...secretsAlt].forEach((secret) => {
      const key = `${secret.metadata?.namespace ?? ''}/${secret.metadata?.name ?? ''}`;
      if (key !== '/') {
        byId.set(key, secret);
      }
    });
    return Array.from(byId.values());
  }, [secrets, secretsAlt]);

  const allRoutes = useMemo(() => {
    const byId = new Map<string, RouteKind>();
    [...routes, ...routesAlt].forEach((route) => {
      const key = `${route.metadata?.namespace ?? ''}/${route.metadata?.name ?? ''}`;
      if (key !== '/') {
        byId.set(key, route);
      }
    });
    return Array.from(byId.values());
  }, [routes, routesAlt]);

  const controllers = useMemo(
    () => discoverControllers(allSecrets, allRoutes),
    [allSecrets, allRoutes],
  );

  const selectedController: RedfishControllerInstance | undefined = useMemo(() => {
    if (!controllers.length) {
      return undefined;
    }
    return controllers.find((c) => c.id === selectedId) ?? controllers[0];
  }, [controllers, selectedId]);

  const loaded = secretsLoaded && secretsAltLoaded && routesLoaded && routesAltLoaded;
  const watchError = secretsError ?? secretsAltError ?? routesError ?? routesAltError;
  const error = controllers.length === 0 ? watchError : undefined;

  return {
    controllers,
    selectedController,
    selectedId: selectedController?.id,
    setSelectedId,
    loaded,
    error,
  };
};
