/**
 * LocalStorage wrapper with type safety and error handling
 */

import { AppSettings, DEFAULT_SETTINGS, Session, Repository } from "@/types/session";

// Storage keys
const STORAGE_KEYS = {
  SETTINGS: "pushtocode:settings",
  SESSIONS: "pushtocode:sessions",
  REPOS: "pushtocode:repos",
  CURRENT_SESSION: "pushtocode:current_session",
  API_KEY: "pushtocode:api_key",
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generic get function with type safety
 */
function get<T>(key: StorageKey, defaultValue: T): T {
  if (typeof window === "undefined" || !isLocalStorageAvailable()) {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Generic set function with type safety
 */
function set<T>(key: StorageKey, value: T): boolean {
  if (typeof window === "undefined" || !isLocalStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing to localStorage (${key}):`, error);
    return false;
  }
}

/**
 * Remove an item from localStorage
 */
function remove(key: StorageKey): boolean {
  if (typeof window === "undefined" || !isLocalStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing from localStorage (${key}):`, error);
    return false;
  }
}

// ============================================
// Settings
// ============================================

export function getSettings(): AppSettings {
  return get<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function setSettings(settings: AppSettings): boolean {
  return set(STORAGE_KEYS.SETTINGS, settings);
}

export function updateSettings(partial: Partial<AppSettings>): boolean {
  const current = getSettings();
  return setSettings({ ...current, ...partial });
}

export function resetSettings(): boolean {
  return setSettings(DEFAULT_SETTINGS);
}

// ============================================
// API Key (stored separately for security)
// ============================================

export function getApiKey(): string {
  return get<string>(STORAGE_KEYS.API_KEY, "");
}

export function setApiKey(apiKey: string): boolean {
  return set(STORAGE_KEYS.API_KEY, apiKey);
}

export function clearApiKey(): boolean {
  return remove(STORAGE_KEYS.API_KEY);
}

// ============================================
// Sessions
// ============================================

interface StoredSession {
  id: string;
  name: string;
  repoPath?: string;
  repoName?: string;
  status: string;
  createdAt: string;
  lastActivityAt: string;
  isInteractive: boolean;
}

export function getSessions(): Session[] {
  const stored = get<StoredSession[]>(STORAGE_KEYS.SESSIONS, []);
  return stored.map((s) => ({
    ...s,
    status: s.status as Session["status"],
    createdAt: new Date(s.createdAt),
    lastActivityAt: new Date(s.lastActivityAt),
  }));
}

export function setSessions(sessions: Session[]): boolean {
  const toStore: StoredSession[] = sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    lastActivityAt: s.lastActivityAt.toISOString(),
  }));
  return set(STORAGE_KEYS.SESSIONS, toStore);
}

export function addSession(session: Session): boolean {
  const sessions = getSessions();
  sessions.push(session);
  return setSessions(sessions);
}

export function updateSession(sessionId: string, updates: Partial<Session>): boolean {
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return false;

  sessions[index] = { ...sessions[index], ...updates };
  return setSessions(sessions);
}

export function removeSession(sessionId: string): boolean {
  const sessions = getSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  return setSessions(filtered);
}

// ============================================
// Current Session
// ============================================

export function getCurrentSessionId(): string | null {
  return get<string | null>(STORAGE_KEYS.CURRENT_SESSION, null);
}

export function setCurrentSessionId(sessionId: string | null): boolean {
  if (sessionId === null) {
    return remove(STORAGE_KEYS.CURRENT_SESSION);
  }
  return set(STORAGE_KEYS.CURRENT_SESSION, sessionId);
}

// ============================================
// Repositories
// ============================================

interface StoredRepository {
  id: string;
  name: string;
  path: string;
  url?: string;
  lastUsed?: string;
  createdAt: string;
}

export function getRepositories(): Repository[] {
  const stored = get<StoredRepository[]>(STORAGE_KEYS.REPOS, []);
  return stored.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
    lastUsed: r.lastUsed ? new Date(r.lastUsed) : undefined,
  }));
}

export function setRepositories(repos: Repository[]): boolean {
  const toStore: StoredRepository[] = repos.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastUsed: r.lastUsed?.toISOString(),
  }));
  return set(STORAGE_KEYS.REPOS, toStore);
}

export function addRepository(repo: Repository): boolean {
  const repos = getRepositories();
  repos.push(repo);
  return setRepositories(repos);
}

export function updateRepository(repoId: string, updates: Partial<Repository>): boolean {
  const repos = getRepositories();
  const index = repos.findIndex((r) => r.id === repoId);
  if (index === -1) return false;

  repos[index] = { ...repos[index], ...updates };
  return setRepositories(repos);
}

export function removeRepository(repoId: string): boolean {
  const repos = getRepositories();
  const filtered = repos.filter((r) => r.id !== repoId);
  return setRepositories(filtered);
}

// ============================================
// Clear All Storage
// ============================================

export function clearAllStorage(): boolean {
  if (typeof window === "undefined" || !isLocalStorageAvailable()) {
    return false;
  }

  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error("Error clearing localStorage:", error);
    return false;
  }
}

// Export storage utilities
export const storage = {
  get,
  set,
  remove,
  isAvailable: isLocalStorageAvailable,
  keys: STORAGE_KEYS,
};
