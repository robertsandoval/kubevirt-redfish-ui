import type { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';

type WatchOptions = Parameters<typeof useK8sWatchResource>[0];

/**
 * Thin wrapper around useK8sWatchResource with explicit tuple typing for strict ESLint.
 */
export const useTypedK8sWatch = <T extends K8sResourceCommon | K8sResourceCommon[]>(
  options: WatchOptions,
): [T, boolean, unknown] => {
  const result = useK8sWatchResource<T>(options);

  if (!options) {
    return [[] as unknown as T, true, undefined];
  }

  let data = result[0];
  if (typeof options === 'object' && 'isList' in options && options.isList) {
    data = (Array.isArray(data) ? data : []) as T;
  }
  return [data, result[1], result[2] as unknown];
};
