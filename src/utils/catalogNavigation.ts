import type { CatalogFilters, CatalogView, SortOption } from '../types';

export type CatalogNavigationState = {
  catalogFilters?: CatalogFilters;
  sort?: SortOption;
  catalogView?: CatalogView;
};
