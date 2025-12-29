"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * PWA install banner - shows when app is installable
 */
export function InstallBanner() {
  const { isInstallable, isInstalled, isIOS, install, dismiss, dismissed } = usePWAInstall();

  // Don't show if already installed, dismissed, or not installable
  if (isInstalled || dismissed || !isInstallable) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-lg p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
            <svg
              className="w-6 h-6 text-bg-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-semibold text-sm">
              Install pushToCode
            </h3>
            <p className="text-text-secondary text-xs mt-0.5">
              {isIOS
                ? "Tap the share button and 'Add to Home Screen'"
                : "Install for quick access and offline use"}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={dismiss}
            className="flex-1 px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Not now
          </button>
          {!isIOS && (
            <button
              onClick={install}
              className="flex-1 px-3 py-2 bg-accent text-bg-primary text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Install
            </button>
          )}
          {isIOS && (
            <div className="flex-1 flex items-center justify-center gap-1 text-xs text-text-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Share → Add to Home</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InstallBanner;
