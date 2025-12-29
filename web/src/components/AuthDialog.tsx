"use client";

/**
 * Authentication dialog component
 * Appears when WebSocket sends auth_required message
 */

import { useEffect, useRef, useCallback, useState } from "react";

export type AuthDialogStatus = "idle" | "submitting" | "success" | "error";

export interface AuthDialogProps {
  isOpen: boolean;
  authUrl?: string;
  onSubmitCode: (code: string) => void;
  onClose: () => void;
  status: AuthDialogStatus;
  errorMessage?: string;
}

/**
 * Inner component that resets when key changes
 */
function AuthDialogContent({
  authUrl,
  onSubmitCode,
  onClose,
  status,
  errorMessage,
}: Omit<AuthDialogProps, "isOpen">) {
  const [code, setCode] = useState("");
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "submitting") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, status]);

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, []);

  // Open browser for OAuth
  const handleOpenBrowser = useCallback(() => {
    if (authUrl) {
      window.open(authUrl, "_blank", "noopener,noreferrer");
    }
  }, [authUrl]);

  // Submit auth code
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedCode = code.trim();
      if (!trimmedCode) {
        setValidationError("Please enter the authorization code");
        return;
      }

      setValidationError("");
      onSubmitCode(trimmedCode);
    },
    [code, onSubmitCode]
  );

  // Close on success after a brief delay
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={status !== "submitting" ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-md bg-bg-secondary rounded-xl shadow-xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 h-14">
          <h2 id="auth-dialog-title" className="text-lg font-semibold text-text-primary">
            Authentication Required
          </h2>
          <button
            onClick={onClose}
            disabled={status === "submitting"}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-border transition-colors text-text-secondary disabled:opacity-50"
            aria-label="Close dialog"
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
        <div className="p-4">
          {status === "success" ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-text-primary font-medium">Authentication Successful</p>
              <p className="text-text-secondary text-sm mt-1">You are now connected</p>
            </div>
          ) : (
            <>
              {/* Instructions */}
              <div className="mb-4 text-sm text-text-secondary">
                <p className="mb-2">To authenticate:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the button below to open the authentication page</li>
                  <li>Sign in with your account</li>
                  <li>Copy the authorization code</li>
                  <li>Paste it here and click Submit</li>
                </ol>
              </div>

              {/* Open Browser Button */}
              {authUrl && (
                <button
                  onClick={handleOpenBrowser}
                  className="w-full py-3 mb-4 rounded-lg bg-accent text-bg-primary font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 min-h-[44px]"
                >
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
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open Browser
                </button>
              )}

              {/* Code Input Form */}
              <form onSubmit={handleSubmit}>
                <label
                  htmlFor="auth-code"
                  className="block text-sm font-medium text-text-primary mb-2"
                >
                  Authorization Code
                </label>
                <input
                  ref={inputRef}
                  id="auth-code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setValidationError("");
                  }}
                  placeholder="Paste your code here"
                  disabled={status === "submitting"}
                  className={`
                    w-full px-4 py-3 rounded-lg mb-2
                    bg-bg-primary text-text-primary
                    placeholder:text-text-secondary
                    focus:outline-none focus:ring-2 focus:ring-accent
                    disabled:opacity-50
                    ${validationError || (status === "error" && errorMessage) ? "ring-2 ring-error" : ""}
                  `}
                />

                {/* Validation Error */}
                {validationError && (
                  <p className="text-sm text-error mb-2">{validationError}</p>
                )}

                {/* Server Error */}
                {status === "error" && errorMessage && (
                  <div className="flex items-center gap-2 p-3 mb-2 rounded-lg bg-error/10 text-error text-sm">
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
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errorMessage}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={status === "submitting" || !code.trim()}
                  className={`
                    w-full py-3 rounded-lg font-medium transition-all min-h-[44px]
                    ${
                      status === "submitting" || !code.trim()
                        ? "bg-border text-text-secondary cursor-not-allowed"
                        : "bg-accent text-bg-primary hover:opacity-90"
                    }
                  `}
                >
                  {status === "submitting" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Wrapper component that handles key-based reset
 * Using a ref to track open count to avoid ESLint warnings about setState in effects
 */
export function AuthDialog({ isOpen, ...props }: AuthDialogProps) {
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

  /* eslint-disable-next-line react-hooks/refs -- Using ref for key is valid */
  return <AuthDialogContent key={openCountRef.current} {...props} />;
}
