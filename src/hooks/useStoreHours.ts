import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DEFAULT_HERO } from '../data/hero';
import type { HeroConfig } from '../types';

export function useStoreHours(): HeroConfig {
  const [config, setConfig] = useState<HeroConfig>(DEFAULT_HERO);

  useEffect(() => {
    api
      .getHero()
      .then((hero) => setConfig({ ...DEFAULT_HERO, ...hero }))
      .catch(() => setConfig(DEFAULT_HERO));
  }, []);

  return config;
}
