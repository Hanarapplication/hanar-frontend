/**
 * Marketplace location filter: match listings to a picked country, US state, or city + radius.
 */

export type MarketplaceLocationScope =
  | { mode: 'none' }
  | { mode: 'country'; country: string }
  | { mode: 'state'; country: string; state: string }
  | {
      mode: 'city_radius';
      country: string;
      state: string;
      city: string;
    };

export type ItemLocationFields = {
  location: string;
  location_country?: string | null;
  location_state?: string | null;
  location_city?: string | null;
};

/** US state/territory abbrev (lowercase) -> full name (lowercase) */
const US_STATE_ABBREV_TO_NAME: Record<string, string> = {
  al: 'alabama',
  ak: 'alaska',
  az: 'arizona',
  ar: 'arkansas',
  ca: 'california',
  co: 'colorado',
  ct: 'connecticut',
  de: 'delaware',
  dc: 'district of columbia',
  fl: 'florida',
  ga: 'georgia',
  hi: 'hawaii',
  id: 'idaho',
  il: 'illinois',
  in: 'indiana',
  ia: 'iowa',
  ks: 'kansas',
  ky: 'kentucky',
  la: 'louisiana',
  me: 'maine',
  md: 'maryland',
  ma: 'massachusetts',
  mi: 'michigan',
  mn: 'minnesota',
  ms: 'mississippi',
  mo: 'missouri',
  mt: 'montana',
  ne: 'nebraska',
  nv: 'nevada',
  nh: 'new hampshire',
  nj: 'new jersey',
  nm: 'new mexico',
  ny: 'new york',
  nc: 'north carolina',
  nd: 'north dakota',
  oh: 'ohio',
  ok: 'oklahoma',
  or: 'oregon',
  pa: 'pennsylvania',
  ri: 'rhode island',
  sc: 'south carolina',
  sd: 'south dakota',
  tn: 'tennessee',
  tx: 'texas',
  ut: 'utah',
  vt: 'vermont',
  va: 'virginia',
  wa: 'washington',
  wv: 'west virginia',
  wi: 'wisconsin',
  wy: 'wyoming',
};

const US_STATE_NAME_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_ABBREV_TO_NAME).map(([ab, name]) => [name, ab])
);

export function normalizeCountryKey(country: string): string {
  const c = country.trim().toLowerCase();
  if (
    c === 'us' ||
    c === 'usa' ||
    c === 'u.s.' ||
    c === 'u.s.a.' ||
    c === 'united states' ||
    c === 'united states of america' ||
    c === 'america'
  ) {
    return 'united states';
  }
  return c;
}

/** Canonical US state key: lowercase abbrev if US state, else trimmed lower. */
export function normalizeUsStateKey(state: string): string {
  const s = state.trim().toLowerCase();
  if (s.length === 2 && US_STATE_ABBREV_TO_NAME[s]) return s;
  const abbr = US_STATE_NAME_TO_ABBREV[s];
  if (abbr) return abbr;
  return s;
}

function statesMatch(a: string, b: string): boolean {
  const ka = normalizeUsStateKey(a);
  const kb = normalizeUsStateKey(b);
  if (ka && kb && ka === kb) return true;
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  if (!la || !lb) return false;
  if (la === lb) return true;
  if (la.length >= 3 && lb.length >= 3 && (la.includes(lb) || lb.includes(la))) return true;
  return false;
}

function countriesMatch(a: string, b: string): boolean {
  return normalizeCountryKey(a) === normalizeCountryKey(b);
}

/** Text fallback when structured country/state are missing (legacy rows). */
function haystack(item: ItemLocationFields): string {
  const parts = [
    item.location,
    item.location_city,
    item.location_state,
    item.location_country,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  return parts.join(' ');
}

function itemInUnitedStates(item: ItemLocationFields): boolean {
  const h = haystack(item);
  if (
    /\bunited states\b/.test(h) ||
    /\bu\.?\s*s\.?\s*a\.?\b/.test(h) ||
    /\busa\b/.test(h) ||
    /,\s*usa\b/.test(h)
  ) {
    return true;
  }
  const st = item.location_state?.trim();
  if (st && US_STATE_ABBREV_TO_NAME[normalizeUsStateKey(st)]) return true;
  for (const abbr of Object.keys(US_STATE_ABBREV_TO_NAME)) {
    const name = US_STATE_ABBREV_TO_NAME[abbr];
    const re = new RegExp(`\\b${abbr}\\b`, 'i');
    if (re.test(h) || new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`, 'i').test(h)) return true;
  }
  return false;
}

export function itemMatchesCountryFilter(item: ItemLocationFields, selectedCountry: string): boolean {
  const want = normalizeCountryKey(selectedCountry);
  const itemCountry = item.location_country?.trim();
  if (itemCountry && countriesMatch(itemCountry, selectedCountry)) return true;
  if (want === 'united states') return itemInUnitedStates(item);
  const h = haystack(item);
  if (want && h.includes(want)) return true;
  return false;
}

export function itemMatchesStateFilter(
  item: ItemLocationFields,
  selectedState: string,
  selectedCountry: string
): boolean {
  const itemState = item.location_state?.trim();
  if (itemState && statesMatch(itemState, selectedState)) {
    const ic = item.location_country?.trim();
    if (ic && selectedCountry && !countriesMatch(ic, selectedCountry)) return false;
    if (!ic && normalizeCountryKey(selectedCountry) === 'united states' && !itemInUnitedStates(item)) {
      return false;
    }
    return true;
  }
  const h = haystack(item);
  const sk = normalizeUsStateKey(selectedState);
  const full = US_STATE_ABBREV_TO_NAME[sk] || selectedState.trim().toLowerCase();
  if (full && new RegExp(`\\b${full.replace(/ /g, '\\s+')}\\b`, 'i').test(h)) return true;
  if (sk.length === 2 && new RegExp(`\\b${sk}\\b`, 'i').test(h)) return true;
  if (normalizeCountryKey(selectedCountry) === 'united states' && !itemInUnitedStates(item)) return false;
  return false;
}

export function scopeFromAddressResult(result: {
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
}): MarketplaceLocationScope {
  const city = (result.city || '').trim();
  const state = (result.state || '').trim();
  const country = (result.country || '').trim();

  if (!city && !state && country) {
    return { mode: 'country', country };
  }
  if (!city && state) {
    return { mode: 'state', country: country || 'United States', state };
  }
  return {
    mode: 'city_radius',
    country,
    state,
    city,
  };
}
