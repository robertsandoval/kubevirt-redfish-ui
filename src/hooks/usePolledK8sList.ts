import type { K8sModel, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { k8sListItems } from '@openshift-console/dynamic-plugin-sdk';
import { useEffect, useState } from 'react';

interface ListQuery {
  ns?: string;
  /** Pass matchLabels object — SDK runs selectorToString() on it */
  labelSelector?: { matchLabels: Record<string, string> };
  fieldSelector?: string;
}

const POLL_MS = 10000;

const buildQueryParams = (query: ListQuery): Record<string, unknown> => {
  const queryParams: Record<string, unknown> = {};
  if (query.ns) {
    queryParams.ns = query.ns;
  }
  if (query.labelSelector) {
    queryParams.labelSelector = query.labelSelector;
  }
  if (query.fieldSelector) {
    queryParams.fieldSelector = query.fieldSelector;
  }
  return queryParams;
};

/**
 * List resources with an explicit K8sModel via the console REST helper.
 * Avoids useK8sWatchResource, which requires the GVK to be registered in the
 * console model store (KubeVirt models are unavailable without the Virt UI plugin).
 */
export const usePolledK8sList = <T extends K8sResourceCommon>(
  model: K8sModel,
  query: ListQuery | null,
  enabled = true,
): [T[], boolean, unknown] => {
  const [data, setData] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(!enabled || !query);
  const [error, setError] = useState<unknown>();
  const queryKey = query
    ? `${model.plural}|${query.ns ?? ''}|${JSON.stringify(query.labelSelector ?? {})}|${query.fieldSelector ?? ''}`
    : `${model.plural}|disabled`;

  useEffect(() => {
    let cancelled = false;
    // Capture for this effect generation (keyed by queryKey)
    const activeQuery = query;
    const activeModel = model;

    const load = () => {
      if (!enabled || !activeQuery) {
        if (!cancelled) {
          setData([]);
          setLoaded(true);
          setError(undefined);
        }
        return;
      }

      void k8sListItems<T>({ model: activeModel, queryParams: buildQueryParams(activeQuery) })
        .then((items) => {
          if (cancelled) {
            return;
          }
          setData(Array.isArray(items) ? items : []);
          setLoaded(true);
          setError(undefined);
        })
        .catch((err: unknown) => {
          if (cancelled) {
            return;
          }
          setError(err);
          setLoaded(true);
        });
    };

    const initial = window.setTimeout(load, 0);
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey encodes query
  }, [enabled, queryKey]);

  return [data, loaded, error];
};

/**
 * List the same resource kind across several namespaces and merge results.
 */
export const usePolledK8sListNamespaces = <T extends K8sResourceCommon>(
  model: K8sModel,
  namespaces: string[],
  enabled = true,
): [T[], boolean, unknown] => {
  const [data, setData] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(!enabled || namespaces.length === 0);
  const [error, setError] = useState<unknown>();
  const nsKey = `${model.plural}|${[...namespaces].sort().join('\0')}`;

  useEffect(() => {
    let cancelled = false;
    const activeModel = model;
    const activeNamespaces = [...namespaces];

    const load = () => {
      if (!enabled || activeNamespaces.length === 0) {
        if (!cancelled) {
          setData([]);
          setLoaded(true);
          setError(undefined);
        }
        return;
      }

      void Promise.all(
        activeNamespaces.map(async (ns) => {
          try {
            const items = await k8sListItems<T>({
              model: activeModel,
              queryParams: { ns },
            });
            return Array.isArray(items) ? items : [];
          } catch {
            return [] as T[];
          }
        }),
      )
        .then((lists) => {
          if (cancelled) {
            return;
          }
          setData(lists.flat());
          setLoaded(true);
          setError(undefined);
        })
        .catch((err: unknown) => {
          if (cancelled) {
            return;
          }
          setError(err);
          setLoaded(true);
        });
    };

    const initial = window.setTimeout(load, 0);
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nsKey encodes namespaces
  }, [enabled, nsKey]);

  return [data, loaded, error];
};
