"use client";

/**
 * Settings panel component
 * Full-page on mobile, slide-over on desktop
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useSettings } from "@/hooks/useSettings";
import { getApiClient } from "@/lib/api";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectionTestStatus = "idle" | "testing" | "success" | "error";

interface ValidationErrors {
  serverUrl?: string;
  apiKey?: string;
}

interface SettingsContentProps {
  onClose: () => void;
  initialServerUrl: string;
  initialApiKey: string;
}

/**
 * Inner content component that resets when key changes
 */
function SettingsContent({ onClose, initialServerUrl, initialApiKey }: SettingsContentProps) {
  const settings = useSettings();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<ConnectionTestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Local form state for server URL (to validate before saving)
  const [localServerUrl, setLocalServerUrl] = useState(initialServerUrl);
  const [localApiKey, setLocalApiKey] = useState(initialApiKey);

  // Focus close button on mount
  useEffect(() => {
    firstFocusableRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Validate server URL
  const validateServerUrl = useCallback((url: string): string | undefined => {
    if (!url.trim()) {
      return "Server URL is required";
    }
    try {
      const parsed = new URL(url);
      if (!["ws:", "wss:", "http:", "https:"].includes(parsed.protocol)) {
        return "URL must use ws, wss, http, or https protocol";
      }
    } catch {
      return "Invalid URL format";
    }
    return undefined;
  }, []);

  // Test connection
  const testConnection = useCallback(async () => {
    const urlError = validateServerUrl(localServerUrl);
    if (urlError) {
      setErrors((prev) => ({ ...prev, serverUrl: urlError }));
      return;
    }

    setTestStatus("testing");
    setTestMessage("");

    try {
      // Convert WebSocket URL to HTTP for health check
      let healthUrl = localServerUrl;
      if (healthUrl.startsWith("ws://")) {
        healthUrl = healthUrl.replace("ws://", "http://");
      } else if (healthUrl.startsWith("wss://")) {
        healthUrl = healthUrl.replace("wss://", "https://");
      }

      const client = getApiClient({ baseUrl: healthUrl, apiKey: localApiKey || undefined });
      const response = await client.health();

      if (response.status === "ok") {
        setTestStatus("success");
        setTestMessage(response.version ? `Connected (v${response.version})` : "Connected");
      } else {
        setTestStatus("error");
        setTestMessage("Server returned error status");
      }
    } catch (error) {
      setTestStatus("error");
      setTestMessage(error instanceof Error ? error.message : "Connection failed");
    }
  }, [localServerUrl, localApiKey, validateServerUrl]);

  // Save settings
  const handleSave = useCallback(() => {
    const urlError = validateServerUrl(localServerUrl);
    if (urlError) {
      setErrors({ serverUrl: urlError });
      return;
    }

    setErrors({});
    settings.setServerUrl(localServerUrl);
    settings.setApiKey(localApiKey);
    settings.markSaved();
  }, [localServerUrl, localApiKey, settings, validateServerUrl]);

  // Check if there are unsaved changes in local form
  const hasLocalChanges =
    localServerUrl !== settings.serverUrl || localApiKey !== settings.apiKey;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:block"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`
          fixed z-50 bg-bg-secondary
          inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-96
          flex flex-col
          animate-in slide-in-from-right duration-300
        `}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
          <h2 id="settings-title" className="text-lg font-semibold text-text-primary">
            Settings
          </h2>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-border transition-colors text-text-secondary"
            aria-label="Close settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Connection Section */}
          <section className="p-4 border-b border-border">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">
              Connection
            </h3>

            {/* Server URL */}
            <div className="mb-4">
              <label
                htmlFor="server-url"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Server URL
              </label>
              <input
                id="server-url"
                type="url"
                value={localServerUrl}
                onChange={(e) => {
                  setLocalServerUrl(e.target.value);
                  setErrors((prev) => ({ ...prev, serverUrl: undefined }));
                  setTestStatus("idle");
                }}
                placeholder="ws://localhost:3001"
                className={`
                  w-full px-4 py-3 rounded-lg
                  bg-bg-primary text-text-primary
                  placeholder:text-text-secondary
                  focus:outline-none focus:ring-2 focus:ring-accent
                  ${errors.serverUrl ? "ring-2 ring-error" : ""}
                `}
              />
              {errors.serverUrl && (
                <p className="mt-1 text-sm text-error">{errors.serverUrl}</p>
              )}
            </div>

            {/* API Key */}
            <div className="mb-4">
              <label
                htmlFor="api-key"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                API Key
              </label>
              <div className="relative">
                <input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={localApiKey}
                  onChange={(e) => {
                    setLocalApiKey(e.target.value);
                    setTestStatus("idle");
                  }}
                  placeholder="Enter API key (optional)"
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <button
                onClick={testConnection}
                disabled={testStatus === "testing"}
                className="px-4 py-2 rounded-lg bg-bg-primary text-text-primary hover:bg-border transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {testStatus === "testing" ? "Testing..." : "Test Connection"}
              </button>
              {testStatus === "success" && (
                <span className="text-sm text-success flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {testMessage}
                </span>
              )}
              {testStatus === "error" && (
                <span className="text-sm text-error flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {testMessage}
                </span>
              )}
            </div>
          </section>

          {/* Appearance Section */}
          <section className="p-4 border-b border-border">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">
              Appearance
            </h3>

            {/* Theme */}
            <div className="mb-4">
              <label
                htmlFor="theme"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Theme
              </label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) =>
                  settings.setTheme(e.target.value as "dark" | "light" | "system")
                }
                className="w-full px-4 py-3 rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px] appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23565f89' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                }}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>

            {/* Font Size */}
            <div className="mb-4">
              <label
                htmlFor="font-size"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Font Size: {settings.fontSize}px
              </label>
              <input
                id="font-size"
                type="range"
                min="12"
                max="20"
                value={settings.fontSize}
                onChange={(e) => settings.setFontSize(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>12px</span>
                <span>20px</span>
              </div>
            </div>

            {/* Sound */}
            <div className="flex items-center justify-between py-2">
              <label
                htmlFor="sound-enabled"
                className="text-sm font-medium text-text-primary"
              >
                Sound Effects
              </label>
              <button
                id="sound-enabled"
                role="switch"
                aria-checked={settings.soundEnabled}
                onClick={() => settings.setSoundEnabled(!settings.soundEnabled)}
                className={`
                  relative w-12 h-7 rounded-full transition-colors
                  ${settings.soundEnabled ? "bg-accent" : "bg-border"}
                `}
              >
                <span
                  className={`
                    absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform
                    ${settings.soundEnabled ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </div>

            {/* Haptic */}
            <div className="flex items-center justify-between py-2">
              <label
                htmlFor="haptic-enabled"
                className="text-sm font-medium text-text-primary"
              >
                Haptic Feedback
              </label>
              <button
                id="haptic-enabled"
                role="switch"
                aria-checked={settings.hapticEnabled}
                onClick={() => settings.setHapticEnabled(!settings.hapticEnabled)}
                className={`
                  relative w-12 h-7 rounded-full transition-colors
                  ${settings.hapticEnabled ? "bg-accent" : "bg-border"}
                `}
              >
                <span
                  className={`
                    absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform
                    ${settings.hapticEnabled ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </div>
          </section>

          {/* About Section */}
          <section className="p-4">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-4">
              About
            </h3>
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                <span className="text-text-primary font-medium">pushToCode</span> - AI-powered terminal
              </p>
              <p>Version 1.0.0</p>
            </div>
          </section>
        </div>

        {/* Footer with Save Button */}
        <footer className="border-t border-border p-4 shrink-0">
          <button
            onClick={handleSave}
            disabled={!hasLocalChanges}
            className={`
              w-full py-3 rounded-lg font-medium transition-all min-h-[44px]
              ${
                hasLocalChanges
                  ? "bg-accent text-bg-primary hover:opacity-90"
                  : "bg-border text-text-secondary cursor-not-allowed"
              }
            `}
          >
            {hasLocalChanges ? "Save Changes" : "No Changes"}
          </button>
        </footer>
      </div>
    </>
  );
}

/**
 * Main Settings component with key-based reset
 * Using refs to track open count to avoid ESLint warnings about setState in effects
 */
export function Settings({ isOpen, onClose }: SettingsProps) {
  const settings = useSettings();
  const openCountRef = useRef(0);
  const wasOpenRef = useRef(false);

  /* eslint-disable react-hooks/refs -- Tracking previous props is a valid use case */
  // Track open transitions using refs to generate unique keys
  if (isOpen && !wasOpenRef.current) {
    openCountRef.current += 1;
  }
  wasOpenRef.current = isOpen;
  /* eslint-enable react-hooks/refs */

  if (!isOpen) return null;

  return (
    <SettingsContent
      /* eslint-disable-next-line react-hooks/refs -- Using ref for key is valid */
      key={openCountRef.current}
      onClose={onClose}
      initialServerUrl={settings.serverUrl}
      initialApiKey={settings.apiKey}
    />
  );
}

/**
 * Settings trigger button (gear icon)
 */
interface SettingsTriggerProps {
  onClick: () => void;
  className?: string;
}

export function SettingsTrigger({ onClick, className = "" }: SettingsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 flex items-center justify-center rounded-lg hover:bg-border transition-colors text-text-secondary hover:text-text-primary ${className}`}
      aria-label="Open settings"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}
