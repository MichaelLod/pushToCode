"use client";

/**
 * React hook for managing app settings with localStorage persistence
 */

import { useState, useCallback } from "react";
import { AppSettings, DEFAULT_SETTINGS } from "@/types/session";
import {
  getSettings,
  setSettings as persistSettings,
  getApiKey,
  setApiKey as persistApiKey,
} from "@/lib/storage";

export interface UseSettingsReturn {
  // Current values
  serverUrl: string;
  apiKey: string;
  theme: AppSettings["theme"];
  fontSize: number;
  fontFamily: string;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  scrollbackLines: number;

  // Setters
  setServerUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setTheme: (theme: AppSettings["theme"]) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setScrollbackLines: (lines: number) => void;

  // Bulk operations
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // State
  isLoaded: boolean;
  hasUnsavedChanges: boolean;
  markSaved: () => void;
}

// Helper to get initial values (runs only once during initial render)
function getInitialSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  return getSettings();
}

function getInitialApiKey(): string {
  if (typeof window === "undefined") return "";
  return getApiKey();
}

export function useSettings(): UseSettingsReturn {
  // Initialize directly from localStorage (lazy initialization)
  const [settings, setSettingsState] = useState<AppSettings>(getInitialSettings);
  const [apiKey, setApiKeyState] = useState<string>(getInitialApiKey);
  const [isLoaded] = useState(() => typeof window !== "undefined");
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = getSettings();
    const storedApiKey = getApiKey();
    return JSON.stringify({ ...stored, apiKey: storedApiKey });
  });

  // Check for unsaved changes
  const currentSnapshot = JSON.stringify({ ...settings, apiKey });
  const hasUnsavedChanges = isLoaded && currentSnapshot !== savedSnapshot;

  // Mark current state as saved
  const markSaved = useCallback(() => {
    setSavedSnapshot(JSON.stringify({ ...settings, apiKey }));
  }, [settings, apiKey]);

  // Helper to update settings and persist
  const updateAndPersist = useCallback(
    (partial: Partial<AppSettings>) => {
      const newSettings = { ...settings, ...partial };
      setSettingsState(newSettings);
      persistSettings(newSettings);
    },
    [settings]
  );

  // Individual setters
  const setServerUrl = useCallback(
    (url: string) => {
      updateAndPersist({ serverUrl: url });
    },
    [updateAndPersist]
  );

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    persistApiKey(key);
  }, []);

  const setTheme = useCallback(
    (theme: AppSettings["theme"]) => {
      updateAndPersist({ theme });
    },
    [updateAndPersist]
  );

  const setFontSize = useCallback(
    (fontSize: number) => {
      // Clamp to valid range
      const clamped = Math.min(20, Math.max(12, fontSize));
      updateAndPersist({ fontSize: clamped });
    },
    [updateAndPersist]
  );

  const setFontFamily = useCallback(
    (fontFamily: string) => {
      updateAndPersist({ fontFamily });
    },
    [updateAndPersist]
  );

  const setSoundEnabled = useCallback(
    (soundEnabled: boolean) => {
      updateAndPersist({ soundEnabled });
    },
    [updateAndPersist]
  );

  const setHapticEnabled = useCallback(
    (hapticEnabled: boolean) => {
      updateAndPersist({ hapticEnabled });
    },
    [updateAndPersist]
  );

  const setScrollbackLines = useCallback(
    (scrollbackLines: number) => {
      updateAndPersist({ scrollbackLines });
    },
    [updateAndPersist]
  );

  // Bulk update
  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      // Handle apiKey separately if included
      if ("apiKey" in partial && partial.apiKey !== undefined) {
        setApiKeyState(partial.apiKey);
        persistApiKey(partial.apiKey);
      }
      // Update other settings
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { apiKey: _apiKey, ...rest } = partial;
      if (Object.keys(rest).length > 0) {
        updateAndPersist(rest);
      }
    },
    [updateAndPersist]
  );

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    setApiKeyState("");
    persistSettings(DEFAULT_SETTINGS);
    persistApiKey("");
  }, []);

  return {
    // Current values
    serverUrl: settings.serverUrl,
    apiKey,
    theme: settings.theme,
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    soundEnabled: settings.soundEnabled,
    hapticEnabled: settings.hapticEnabled,
    scrollbackLines: settings.scrollbackLines,

    // Setters
    setServerUrl,
    setApiKey,
    setTheme,
    setFontSize,
    setFontFamily,
    setSoundEnabled,
    setHapticEnabled,
    setScrollbackLines,

    // Bulk operations
    updateSettings,
    resetSettings,

    // State
    isLoaded,
    hasUnsavedChanges,
    markSaved,
  };
}
