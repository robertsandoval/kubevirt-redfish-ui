/** Extract a human-readable message from console / k8s watch errors. */
export const formatError = (error: unknown): string => {
  if (error == null || error === false) {
    return '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
    if (typeof record.status === 'string' && record.status) {
      return record.status;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  return 'Unknown error';
};

export const isForbiddenError = (error: unknown): boolean => {
  const msg = formatError(error).toLowerCase();
  return msg.includes('forbidden') || msg.includes('403') || msg.includes('cannot list');
};
