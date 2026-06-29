/**
 * AppSettingsService
 *
 * Manages application settings in localStorage.
 */
import type { AppSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const SETTINGS_KEY = "mbdc_settings";

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === "undefined") return;
  const current = getSettings();
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...current, ...settings })
  );
}
