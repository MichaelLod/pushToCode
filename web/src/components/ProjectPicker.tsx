"use client";

/**
 * Project picker component
 * Dropdown on desktop, native select on mobile
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Repository } from "@/types/session";
import ApiClient, { getApiClient } from "@/lib/api";
import { getRepositories, updateRepository, setRepositories as persistRepositories } from "@/lib/storage";

interface ProjectPickerProps {
  selectedRepoId: string | null;
  onSelectRepo: (repo: Repository | null) => void;
  className?: string;
  serverUrl?: string;
  apiKey?: string;
}

export function ProjectPicker({
  selectedRepoId,
  onSelectRepo,
  className = "",
  serverUrl,
  apiKey,
}: ProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load repos from cache initially
  useEffect(() => {
    const cached = getRepositories();
    if (cached.length > 0) {
      setRepos(cached);
    }
  }, []);

  // Fetch repos from server
  const fetchRepos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use provided credentials or fall back to singleton
      const client = serverUrl && apiKey
        ? new ApiClient({
            baseUrl: serverUrl.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://'),
            apiKey,
          })
        : getApiClient();
      const serverRepos = await client.listRepos();

      // Merge with cached repos to preserve lastUsed timestamps
      const cached = getRepositories();
      const merged = serverRepos.map((serverRepo) => {
        const cachedRepo = cached.find((c) => c.id === serverRepo.id);
        return {
          ...serverRepo,
          lastUsed: cachedRepo?.lastUsed || serverRepo.lastUsed,
        };
      });

      setRepos(merged);
      persistRepositories(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
      // Fall back to cached repos
      const cached = getRepositories();
      if (cached.length > 0) {
        setRepos(cached);
      }
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl, apiKey]);

  // Fetch repos on mount and when dropdown opens
  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchRepos();
    }
  }, [isOpen, fetchRepos]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Sort repos: recent first
  const sortedRepos = useMemo(() => {
    return [...repos].sort((a, b) => {
      // Recently used first
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed.getTime() - a.lastUsed.getTime();
      }
      if (a.lastUsed) return -1;
      if (b.lastUsed) return 1;
      // Then by name
      return a.name.localeCompare(b.name);
    });
  }, [repos]);

  // Get selected repo
  const selectedRepo = useMemo(() => {
    return repos.find((r) => r.id === selectedRepoId) || null;
  }, [repos, selectedRepoId]);

  // Truncate path from start
  const truncatePath = useCallback((path: string, maxLength = 30): string => {
    if (path.length <= maxLength) return path;
    const parts = path.split("/");
    let result = parts[parts.length - 1];

    for (let i = parts.length - 2; i >= 0; i--) {
      const next = parts[i] + "/" + result;
      if (next.length + 3 > maxLength) break;
      result = next;
    }

    return "..." + result;
  }, []);

  // Handle selection
  const handleSelect = useCallback(
    (repo: Repository | null) => {
      if (repo) {
        // Update lastUsed
        updateRepository(repo.id, { lastUsed: new Date() });
        setRepos((prev) =>
          prev.map((r) => (r.id === repo.id ? { ...r, lastUsed: new Date() } : r))
        );
      }
      onSelectRepo(repo);
      setIsOpen(false);
    },
    [onSelectRepo]
  );

  // Handle native select change
  const handleNativeSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const repoId = e.target.value;
      if (!repoId) {
        handleSelect(null);
      } else {
        const repo = repos.find((r) => r.id === repoId);
        if (repo) {
          handleSelect(repo);
        }
      }
    },
    [repos, handleSelect]
  );

  // Toggle dropdown
  const handleToggle = useCallback(() => {
    if (isMobile) {
      // Trigger native select on mobile
      selectRef.current?.focus();
      selectRef.current?.click();
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [isMobile]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 h-11 rounded-lg hover:bg-border transition-colors text-text-primary min-w-0"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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
          className="shrink-0 text-text-secondary"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="truncate max-w-[150px] text-sm">
          {selectedRepo ? selectedRepo.name : "Select Project"}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Hidden Native Select for Mobile */}
      {isMobile && (
        <select
          ref={selectRef}
          value={selectedRepoId || ""}
          onChange={handleNativeSelectChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Select project"
        >
          <option value="">Select Project</option>
          {sortedRepos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
      )}

      {/* Desktop Dropdown */}
      {!isMobile && isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Projects"
          className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto bg-bg-secondary border border-border rounded-lg shadow-xl z-50"
        >
          {/* Loading State */}
          {isLoading && repos.length === 0 && (
            <div className="p-4 text-center text-text-secondary">
              <svg
                className="animate-spin h-5 w-5 mx-auto mb-2"
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
              Loading projects...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3 text-sm text-error bg-error/10 border-b border-border">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && repos.length === 0 && !error && (
            <div className="p-4 text-center text-text-secondary text-sm">
              No projects found
            </div>
          )}

          {/* Repo List */}
          {sortedRepos.length > 0 && (
            <>
              {/* Clear Selection Option */}
              {selectedRepoId && (
                <button
                  onClick={() => handleSelect(null)}
                  className="w-full px-4 py-3 text-left text-sm text-text-secondary hover:bg-border transition-colors border-b border-border flex items-center gap-2"
                >
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
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Clear selection
                </button>
              )}

              {/* Recent Label */}
              {sortedRepos.some((r) => r.lastUsed) && (
                <div className="px-4 py-2 text-xs text-text-secondary uppercase tracking-wide bg-bg-primary">
                  Recent
                </div>
              )}

              {/* Repo Items */}
              {sortedRepos.map((repo, index) => {
                const isRecent = !!repo.lastUsed;
                const isFirstNonRecent =
                  !isRecent && index > 0 && sortedRepos[index - 1].lastUsed;

                return (
                  <div key={repo.id}>
                    {isFirstNonRecent && (
                      <div className="px-4 py-2 text-xs text-text-secondary uppercase tracking-wide bg-bg-primary">
                        All Projects
                      </div>
                    )}
                    <button
                      role="option"
                      aria-selected={repo.id === selectedRepoId}
                      onClick={() => handleSelect(repo)}
                      className={`
                        w-full px-4 py-3 text-left hover:bg-border transition-colors min-h-[44px]
                        ${repo.id === selectedRepoId ? "bg-accent/10" : ""}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        {repo.id === selectedRepoId && (
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
                            className="shrink-0 text-accent"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <div className={repo.id === selectedRepoId ? "" : "ml-6"}>
                          <div className="text-sm font-medium text-text-primary">
                            {repo.name}
                          </div>
                          <div className="text-xs text-text-secondary truncate">
                            {truncatePath(repo.path)}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Loading indicator when refreshing */}
          {isLoading && repos.length > 0 && (
            <div className="p-2 text-center text-xs text-text-secondary border-t border-border">
              Refreshing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
