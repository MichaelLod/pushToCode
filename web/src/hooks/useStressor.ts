"use client";

/**
 * React hook for managing stressor daemon via API
 */

import { useState, useCallback, useEffect } from "react";
import { getApiClient, StressorStatus, StressorConfig } from "@/lib/api";
import { useSettings } from "./useSettings";

export interface UseStressorReturn {
  // State
  status: StressorStatus | null;
  config: StressorConfig | null;
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  addProject: (path: string) => Promise<boolean>;
  removeProject: (path: string) => Promise<boolean>;
  updateConfig: (config: Partial<StressorConfig>) => Promise<boolean>;
}

export function useStressor(): UseStressorReturn {
  const settings = useSettings();
  const [status, setStatus] = useState<StressorStatus | null>(null);
  const [config, setConfig] = useState<StressorConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get API client with current settings
  const getClient = useCallback(() => {
    let baseUrl = settings.serverUrl;
    if (baseUrl.startsWith("ws://")) {
      baseUrl = baseUrl.replace("ws://", "http://");
    } else if (baseUrl.startsWith("wss://")) {
      baseUrl = baseUrl.replace("wss://", "https://");
    }
    return getApiClient({ baseUrl, apiKey: settings.apiKey || undefined });
  }, [settings.serverUrl, settings.apiKey]);

  // Refresh status and config
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const [statusRes, configRes] = await Promise.all([
        client.getStressorStatus(),
        client.getStressorConfig(),
      ]);
      setStatus(statusRes);
      setConfig(configRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stressor status");
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  // Start daemon
  const start = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const result = await client.startStressor();
      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.message);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start stressor");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getClient, refresh]);

  // Stop daemon
  const stop = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const result = await client.stopStressor();
      if (result.success) {
        await refresh();
        return true;
      } else {
        setError(result.message);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop stressor");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getClient, refresh]);

  // Add project
  const addProject = useCallback(async (path: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const newConfig = await client.addStressorProject(path);
      setConfig(newConfig);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add project");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  // Remove project
  const removeProject = useCallback(async (path: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const newConfig = await client.removeStressorProject(path);
      setConfig(newConfig);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove project");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  // Update config
  const updateConfig = useCallback(async (updates: Partial<StressorConfig>): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const client = getClient();
      const newConfig = await client.updateStressorConfig(updates);
      setConfig(newConfig);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update config");
      return false;
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  // Initial fetch when server URL changes
  useEffect(() => {
    if (settings.serverUrl) {
      refresh();
    }
  }, [settings.serverUrl, refresh]);

  return {
    status,
    config,
    loading,
    error,
    refresh,
    start,
    stop,
    addProject,
    removeProject,
    updateConfig,
  };
}
