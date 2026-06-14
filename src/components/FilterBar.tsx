import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, Grid2X2, Grid3X3, SlidersHorizontal } from 'lucide-react';
import type { CatalogFilters, CatalogView, SortOption } from '../types';

interface FilterBarProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
}

const defaultFilters: CatalogFilters = {
  priceFrom: null,
  priceTo: null,
  type: 'all',
  audience: 'all',
  color: 'all',
  material: 'all',
};

type DropdownOption<Value extends string> = {
  value: Value;
  label: string;
};

const sortOptions: DropdownOption<SortOption>[] = [
  { value: 'popular', label: 'По популярности' },
  { value: 'rating', label: 'По рейтингу' },
  { value: 'discount', label: 'Больше скидка' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
];

const pricePresets: Array<{ label: string; from: number | null; to: number | null }> = [
  { label: 'Все цены', from: null, to: null },
  { label: 'До 1 000 ₽', from: null, to: 1000 },
  { label: '1 000–2 500 ₽', from: 1000, to: 2500 },
  { label: 'От 2 500 ₽', from: 2500, to: null },
];

const typeOptions: DropdownOption<CatalogFilters['type']>[] = [
  { value: 'all', label: 'Тип товара' },
  { value: 'rings', label: 'Кольца' },
  { value: 'sets', label: 'Наборы' },
  { value: 'bags', label: 'Сумки' },
  { value: 'lashes', label: 'Ресницы' },
  { value: 'shoes', label: 'Обувь' },
  { value: 'accessories', label: 'Аксессуары' },
  { value: 'clothes', label: 'Одежда' },
  { value: 'beauty', label: 'Красота' },
  { value: 'other', label: 'Другое' },
];

const audienceOptions: DropdownOption<CatalogFilters['audience']>[] = [
  { value: 'all', label: 'Муж / Жен' },
  { value: 'women', label: 'Женское' },
  { value: 'men', label: 'Мужское' },
];

const colorOptions: DropdownOption<CatalogFilters['color']>[] = [
  { value: 'all', label: 'Цвет' },
  { value: 'pink', label: 'Розовый' },
  { value: 'black', label: 'Чёрный' },
  { value: 'silver', label: 'Серебро' },
  { value: 'white', label: 'Белый' },
];

const materialOptions: DropdownOption<CatalogFilters['material']>[] = [
  { value: 'all', label: 'Состав' },
  { value: 'jewelry', label: 'Бижутерия' },
  { value: 'textile', label: 'Текстиль / экокожа' },
  { value: 'synthetic', label: 'Синтетика' },
];

function formatPriceValue(value: number) {
  return value.toLocaleString('ru-RU');
}

function getPriceFilterLabel(from: number | null, to: number | null) {
  if (from == null && to == null) return 'Цена, ₽';
  if (from != null && to != null) return `${formatPriceValue(from)}–${formatPriceValue(to)} ₽`;
  if (from != null) return `От ${formatPriceValue(from)} ₽`;
  return `До ${formatPriceValue(to!)} ₽`;
}

function parsePriceInput(value: string): number | null {
  const trimmed = value.replace(/\s/g, '').replace(/[^\d]/g, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizePriceRange(from: number | null, to: number | null) {
  if (from != null && to != null && from > to) {
    return { priceFrom: to, priceTo: from };
  }
  return { priceFrom: from, priceTo: to };
}

function isSamePriceRange(
  aFrom: number | null,
  aTo: number | null,
  bFrom: number | null,
  bTo: number | null
) {
  return aFrom === bFrom && aTo === bTo;
}

interface FilterDropdownProps<Value extends string> {
  id: string;
  icon?: ReactNode;
  value: Value;
  options: DropdownOption<Value>[];
  onChange: (value: Value) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  wide?: boolean;
}

function FilterDropdown<Value extends string>({
  id,
  icon,
  value,
  options,
  onChange,
  openMenu,
  setOpenMenu,
  wide,
}: FilterDropdownProps<Value>) {
  const isOpen = openMenu === id;
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`filter-dropdown ${wide ? 'filter-dropdown--wide' : ''}`}>
      <button
        type="button"
        className={`filter-dropdown__trigger ${isOpen ? 'filter-dropdown__trigger--open' : ''}`}
        onClick={() => setOpenMenu(isOpen ? null : id)}
        aria-expanded={isOpen}
      >
        {icon}
        <span>{selected.label}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      <div className={`filter-dropdown__menu ${isOpen ? 'filter-dropdown__menu--open' : ''}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? 'filter-dropdown__option filter-dropdown__option--active' : 'filter-dropdown__option'}
            onClick={() => {
              onChange(option.value);
              setOpenMenu(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PriceFilterDropdownProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
}

function PriceFilterDropdown({ filters, onFiltersChange, openMenu, setOpenMenu }: PriceFilterDropdownProps) {
  const isOpen = openMenu === 'price';
  const hasActiveFilter = filters.priceFrom != null || filters.priceTo != null;
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFromInput(filters.priceFrom != null ? String(filters.priceFrom) : '');
    setToInput(filters.priceTo != null ? String(filters.priceTo) : '');
  }, [isOpen, filters.priceFrom, filters.priceTo]);

  const applyCustomRange = () => {
    const next = normalizePriceRange(parsePriceInput(fromInput), parsePriceInput(toInput));
    onFiltersChange({ ...filters, ...next });
    setOpenMenu(null);
  };

  const applyPreset = (from: number | null, to: number | null) => {
    onFiltersChange({ ...filters, priceFrom: from, priceTo: to });
    setOpenMenu(null);
  };

  return (
    <div className="filter-dropdown filter-dropdown--price">
      <button
        type="button"
        className={`filter-dropdown__trigger ${isOpen ? 'filter-dropdown__trigger--open' : ''} ${hasActiveFilter ? 'filter-dropdown__trigger--active' : ''}`}
        onClick={() => setOpenMenu(isOpen ? null : 'price')}
        aria-expanded={isOpen}
      >
        <span>{getPriceFilterLabel(filters.priceFrom, filters.priceTo)}</span>
        <ChevronDown size={14} aria-hidden />
      </button>

      <div className={`filter-dropdown__menu filter-dropdown__menu--price ${isOpen ? 'filter-dropdown__menu--open' : ''}`}>
        <p className="filter-price__title">Цена, ₽</p>

        <div className="filter-price__presets">
          {pricePresets.map((preset) => {
            const isActive = isSamePriceRange(filters.priceFrom, filters.priceTo, preset.from, preset.to);
            return (
              <button
                key={preset.label}
                type="button"
                className={isActive ? 'filter-dropdown__option filter-dropdown__option--active' : 'filter-dropdown__option'}
                onClick={() => applyPreset(preset.from, preset.to)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="filter-price__custom">
          <label className="filter-price__field">
            <span>От</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="100"
              value={fromInput}
              onChange={(event) => setFromInput(event.target.value.replace(/[^\d\s]/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyCustomRange();
              }}
            />
          </label>
          <label className="filter-price__field">
            <span>До</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1 000"
              value={toInput}
              onChange={(event) => setToInput(event.target.value.replace(/[^\d\s]/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyCustomRange();
              }}
            />
          </label>
        </div>

        <button type="button" className="filter-price__apply" onClick={applyCustomRange}>
          Применить
        </button>
      </div>
    </div>
  );
}

export function FilterBar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: FilterBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const updateFilter = <Key extends keyof CatalogFilters>(
    key: Key,
    value: CatalogFilters[Key]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__controls" aria-label="Фильтры каталога">
        <FilterDropdown
          id="sort"
          icon={<ArrowUpDown size={15} aria-hidden />}
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          wide
        />

        <button
          type="button"
          className="filter-reset"
          onClick={() => onFiltersChange(defaultFilters)}
        >
          <SlidersHorizontal size={15} aria-hidden />
          Все фильтры
        </button>

        <PriceFilterDropdown
          filters={filters}
          onFiltersChange={onFiltersChange}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />

        <FilterDropdown
          id="type"
          value={filters.type}
          options={typeOptions}
          onChange={(value) => updateFilter('type', value)}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />

        <FilterDropdown
          id="audience"
          value={filters.audience}
          options={audienceOptions}
          onChange={(value) => updateFilter('audience', value)}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />

        <FilterDropdown
          id="color"
          value={filters.color}
          options={colorOptions}
          onChange={(value) => updateFilter('color', value)}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />

        <FilterDropdown
          id="material"
          value={filters.material}
          options={materialOptions}
          onChange={(value) => updateFilter('material', value)}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />
      </div>

      <div className="filter-bar__view" aria-label="Вид каталога">
        <button
          type="button"
          className={`filter-view__button ${view === 'comfortable' ? 'filter-view__button--active' : ''}`}
          onClick={() => onViewChange('comfortable')}
          aria-label="Крупная сетка"
        >
          <Grid2X2 size={16} />
        </button>
        <button
          type="button"
          className={`filter-view__button ${view === 'compact' ? 'filter-view__button--active' : ''}`}
          onClick={() => onViewChange('compact')}
          aria-label="Компактная сетка"
        >
          <Grid3X3 size={16} />
        </button>
      </div>
    </div>
  );
}
