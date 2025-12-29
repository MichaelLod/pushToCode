"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface UsePWAInstallReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  install: () => Promise<boolean>;
  dismiss: () => void;
  dismissed: boolean;
}

/**
 * Hook for handling PWA installation prompt
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Check if dismissed previously (stored in localStorage)
    const wasDismissed = localStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      // Allow prompt again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setInstallPrompt(null);
        return true;
      }
    } catch (err) {
      console.error("Install prompt error:", err);
    }

    return false;
  }, [installPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  return {
    isInstallable: !!installPrompt || isIOS,
    isInstalled,
    isIOS,
    install,
    dismiss,
    dismissed,
  };
}
