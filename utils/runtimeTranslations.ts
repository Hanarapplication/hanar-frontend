type RuntimeTranslationMap = Record<string, string>;

const runtimeTranslationsByLang: Record<string, RuntimeTranslationMap> = {};

export function setRuntimeTranslations(lang: string, translations: RuntimeTranslationMap) {
  runtimeTranslationsByLang[lang] = translations;
}

export function getRuntimeTranslation(lang: string, key: string): string | undefined {
  return runtimeTranslationsByLang[lang]?.[key];
}

export function getRuntimeTranslations(lang: string): RuntimeTranslationMap {
  return runtimeTranslationsByLang[lang] || {};
}
