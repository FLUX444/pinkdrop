import type { CatalogFilters, CatalogView, FilterTag, SortOption } from '../types';

export type CatalogNavigationState = {
  catalogFilters?: CatalogFilters;
  sort?: SortOption;
  catalogView?: CatalogView;
  filterTag?: FilterTag;
};
