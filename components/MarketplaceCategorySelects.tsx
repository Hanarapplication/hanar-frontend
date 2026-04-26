'use client';

import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import {
  formatMarketplaceCategory,
  getParentOptions,
  getSubcategoryOptionsForParent,
  marketplaceCategories,
  parseMarketplaceCategoryForForm,
} from '@/lib/marketplaceCategories';

type Props = {
  value: string;
  onChange: (fullCategory: string) => void;
  disabled?: boolean;
  /** e.g. "mb-1" for label; full label line */
  labelId?: string;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
};

/**
 * Top-level category + subcategory, persisted as a single `category` field,
 * e.g. `Vehicles — Cars`.
 */
export function MarketplaceCategorySelects({
  value,
  onChange,
  disabled = false,
  labelId = 'marketplace-category',
  className = 'space-y-2',
  labelClassName = 'block text-sm font-medium text-slate-700 dark:text-slate-300',
  selectClassName = 'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30',
  categoryLabel = 'Category',
  subcategoryLabel = 'Subcategory',
}: Props) {
  const { effectiveLang } = useLanguage();
  const { parent, sub } = parseMarketplaceCategoryForForm(value);
  const parentOptions = getParentOptions(value);
  const subOptions = parent ? getSubcategoryOptionsForParent(parent, value) : [];

  return (
    <div className={className} role="group" aria-labelledby={labelId}>
      <div>
        <label htmlFor={`${labelId}-parent`} className={labelClassName}>
          {t(effectiveLang, categoryLabel)}
        </label>
        <select
          id={`${labelId}-parent`}
          value={parent}
          onChange={(e) => {
            const newParent = e.target.value;
            const def = marketplaceCategories.find((c) => c.label === newParent);
            const nextSub = def?.subcategories[0] ?? '';
            onChange(formatMarketplaceCategory(newParent, nextSub));
          }}
          disabled={disabled}
          className={selectClassName}
        >
          <option value="">{`— ${t(effectiveLang, categoryLabel)} —`}</option>
          {parentOptions.map((p) => (
            <option key={p} value={p}>
              {t(effectiveLang, p)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${labelId}-sub`} className={labelClassName}>
          {t(effectiveLang, subcategoryLabel)}
        </label>
        <select
          id={`${labelId}-sub`}
          value={sub}
          onChange={(e) => onChange(formatMarketplaceCategory(parent, e.target.value))}
          disabled={disabled || !parent}
          className={selectClassName + (!parent ? ' opacity-60' : '')}
        >
          {subOptions.length === 0 && (
            <option value="">{`— ${t(effectiveLang, subcategoryLabel)} —`}</option>
          )}
          {subOptions.map((s) => (
            <option key={s} value={s}>
              {t(effectiveLang, s)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function isVehiclesCategoryString(stored: string): boolean {
  return parseMarketplaceCategoryForForm(stored).parent === 'Vehicles';
}
