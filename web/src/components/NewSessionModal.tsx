"use client";

import { useState, useCallback, useEffect } from "react";
import { Repository } from "@/types/session";
import { ProjectPicker } from "./ProjectPicker";

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (repoPath: string, repoName: string) => void;
}

export function NewSessionModal({
  isOpen,
  onClose,
  onConfirm,
}: NewSessionModalProps) {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [customPath, setCustomPath] = useState("");
  const [useCustomPath, setUseCustomPath] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRepo(null);
      setCustomPath("");
      setUseCustomPath(false);
    }
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    if (useCustomPath && customPath.trim()) {
      const pathName = customPath.split("/").pop() || "Terminal";
      onConfirm(customPath.trim(), pathName);
    } else if (selectedRepo) {
      onConfirm(selectedRepo.path, selectedRepo.name);
    }
  }, [useCustomPath, customPath, selectedRepo, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (selectedRepo || (useCustomPath && customPath.trim()))) {
        handleConfirm();
      }
    },
    [onClose, handleConfirm, selectedRepo, useCustomPath, customPath]
  );

  if (!isOpen) return null;

  const canConfirm = selectedRepo || (useCustomPath && customPath.trim());

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-bg-secondary border border-border rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            New Terminal
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-border transition-colors text-text-secondary"
            aria-label="Close"
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
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Select a project folder for this terminal:
          </p>

          {/* Project Picker */}
          {!useCustomPath && (
            <div className="border border-border rounded-lg p-2 bg-bg-primary">
              <ProjectPicker
                selectedRepoId={selectedRepo?.id ?? null}
                onSelectRepo={setSelectedRepo}
                className="w-full"
              />
            </div>
          )}

          {/* Custom Path Toggle */}
          <button
            onClick={() => setUseCustomPath(!useCustomPath)}
            className="text-sm text-accent hover:underline"
          >
            {useCustomPath ? "Select from projects" : "Enter custom path"}
          </button>

          {/* Custom Path Input */}
          {useCustomPath && (
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="/path/to/project"
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm bg-accent text-bg-primary rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
