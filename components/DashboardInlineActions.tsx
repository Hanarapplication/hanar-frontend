'use client';

import Link from 'next/link';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getNativeLanguageName, supportedLanguages } from '@/utils/languages';
import { t } from '@/utils/translations';

/** Same shape as former burger menu items */
export type DashboardInlineMenuItem = {
  label: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  color?: string;
};

type DashboardInlineActionsProps = {
  title: string;
  subtitle?: string;
  items: DashboardInlineMenuItem[];
  showLanguage?: boolean;
  translateLabels?: boolean;
};

/** Full-bleed, borderless tiles on grey canvas */
const fbOuter = 'w-full overflow-hidden bg-white dark:bg-gray-800';

const fbHeader = 'bg-white px-4 py-3 sm:px-5 dark:bg-gray-800';

const fbCanvas = 'bg-[#f0f2f5] p-3 dark:bg-gray-950/40';

const fbTile =
  'flex min-h-[5.25rem] flex-col items-start gap-2 rounded-xl bg-white p-3 text-left shadow-none transition-colors hover:bg-[#f2f3f5] active:bg-[#e4e6eb] dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-600';

const fbIconWrap =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 dark:text-gray-300 [&_svg]:h-6 [&_svg]:w-6';

const fbLogoutBarDanger =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[15px] font-semibold text-red-700 shadow-none transition-colors hover:bg-red-50 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/40';

/** Shared with business dashboard expandable panels (same UI language as Quick actions tiles) */
export const dashboardFbOuter = fbOuter;
export const dashboardFbHeader = fbHeader;
export const dashboardFbCanvas = fbCanvas;
export const dashboardFbTile = fbTile;
export const dashboardFbIconWrap = fbIconWrap;
export const dashboardFbPanelShell =
  'rounded-xl bg-white shadow-none dark:bg-gray-800 overflow-hidden';
export const dashboardFbPanelTrigger =
  'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[#f2f3f5] active:bg-[#e4e6eb] dark:hover:bg-gray-700 dark:active:bg-gray-600';
export const dashboardFbPanelTitle =
  'text-[15px] font-semibold leading-snug text-[#050505] dark:text-gray-100';

export function DashboardInlineActions({
  title,
  subtitle,
  items,
  showLanguage,
  translateLabels = true,
}: DashboardInlineActionsProps) {
  const { effectiveLang, lang, setLang } = useLanguage();

  const lbl = (s: string) => (translateLabels ? t(effectiveLang, s) : s);
  const logoutItem = items.length > 0 ? items[items.length - 1] : null;
  const primaryItems = items.length > 1 ? items.slice(0, -1) : items;

  const renderIcon = (item: DashboardInlineMenuItem) =>
    item.icon ? <span className={fbIconWrap}>{item.icon}</span> : null;

  const tileContent = (item: DashboardInlineMenuItem) => {
    const label = lbl(item.label);
    const sub = item.subtitle ? lbl(item.subtitle) : null;
    return (
      <>
        {renderIcon(item)}
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-semibold leading-snug text-[#050505] dark:text-gray-100">{label}</span>
          {sub ? <span className="mt-1 block text-[13px] leading-snug text-[#65676B] dark:text-gray-400">{sub}</span> : null}
        </span>
      </>
    );
  };

  return (
    <section className={fbOuter}>
      <div className={fbHeader}>
        <h2 className="text-[17px] font-bold leading-tight text-[#050505] dark:text-gray-100">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] leading-snug text-[#65676B] dark:text-gray-400">{subtitle}</p> : null}
      </div>

      <div className={fbCanvas}>
        <div className="grid grid-cols-2 gap-2">
          {primaryItems.map((item, i) => {
            if (item.href) {
              return (
                <Link key={i} href={item.href} className={fbTile}>
                  {tileContent(item)}
                </Link>
              );
            }
            return (
              <button key={i} type="button" onClick={item.onClick} className={fbTile}>
                {tileContent(item)}
              </button>
            );
          })}
        </div>

        {logoutItem ? (
          <div className="mt-2">
            {logoutItem.href ? (
              <Link href={logoutItem.href} className={fbLogoutBarDanger}>
                {renderIcon(logoutItem)}
                <span>{lbl(logoutItem.label)}</span>
              </Link>
            ) : (
              <button type="button" onClick={logoutItem.onClick} className={fbLogoutBarDanger}>
                {renderIcon(logoutItem)}
                <span>{lbl(logoutItem.label)}</span>
              </button>
            )}
          </div>
        ) : null}

        {showLanguage ? (
          <div className="mt-3 bg-white p-4 dark:bg-gray-800">
            <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#050505] dark:text-gray-200">
              <Languages className="h-4 w-4 text-[#65676B] dark:text-gray-400" aria-hidden />
              {t(effectiveLang, 'Language')}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#65676B]">🌐</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-lg border-0 bg-[#f0f2f5] py-2.5 pl-9 pr-10 text-[15px] font-medium text-[#050505] ring-0 transition focus:border-0 focus:outline-none focus:ring-2 focus:ring-[#1877f2]/35 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-[#1877f2]/40"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2365676B\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '0.85rem',
                }}
              >
                {supportedLanguages.map(({ code, name, emoji }) => (
                  <option key={code} value={code}>
                    {emoji} {getNativeLanguageName(code, name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
