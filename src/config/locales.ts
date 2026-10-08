export const SUPPORTED_LOCALES = ["en", "mr", "hi"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
