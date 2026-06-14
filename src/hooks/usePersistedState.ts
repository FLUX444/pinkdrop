import { useEffect, useState } from 'react';
import { readFormDraft, writeFormDraft } from '../utils/formDraft';

export function usePersistedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readFormDraft<T>(key) ?? initialValue);

  useEffect(() => {
    writeFormDraft(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
