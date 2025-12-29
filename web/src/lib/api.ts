/**
 * API client for pushToCode backend
 * Includes x-api-key authentication
 */

import { Repository } from "@/types/session";

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export interface HealthResponse {
  status: "ok" | "error";
  version?: string;
  timestamp?: string;
}

export interface TranscribeResponse {
  text: string;
  confidence?: number;
  language?: string;
}

export interface RepoResponse {
  id: string;
  name: string;
  path: string;
  url?: string;
  createdAt: string;
  lastUsed?: string;
}

export interface ReposListResponse {
  repos: RepoResponse[];
}

export interface CreateRepoRequest {
  name: string;
  path: string;
  url?: string;
}

class ApiClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = options.apiKey || null;
  }

  /**
   * Set the API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Clear the API key
   */
  clearApiKey(): void {
    this.apiKey = null;
  }

  /**
   * Make an authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      ...(options.headers || {}),
    };

    // Add API key header if set
    if (this.apiKey) {
      (headers as Record<string, string>)["x-api-key"] = this.apiKey;
    }

    // Add Content-Type for JSON requests (unless it's FormData)
    if (options.body && !(options.body instanceof FormData)) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiError;

      try {
        errorData = await response.json();
      } catch {
        errorData = {
          code: "UNKNOWN_ERROR",
          message: response.statusText || "An unknown error occurred",
          status: response.status,
        };
      }

      throw new ApiClientError(
        errorData.message,
        errorData.code,
        response.status
      );
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    return {} as T;
  }

  // ============================================
  // Health
  // ============================================

  /**
   * Check API health
   */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/health");
  }

  // ============================================
  // Transcription
  // ============================================

  /**
   * Transcribe audio file
   * @param audioBlob - Audio blob to transcribe
   * @param filename - Optional filename (defaults to "audio.webm")
   */
  async transcribe(
    audioBlob: Blob,
    filename = "audio.webm"
  ): Promise<TranscribeResponse> {
    const formData = new FormData();
    formData.append("audio", audioBlob, filename);

    return this.request<TranscribeResponse>("/api/transcribe", {
      method: "POST",
      body: formData,
    });
  }

  // ============================================
  // Repositories
  // ============================================

  /**
   * List all repositories
   */
  async listRepos(): Promise<Repository[]> {
    const response = await this.request<ReposListResponse>("/api/repos");
    return response.repos.map(this.mapRepoResponse);
  }

  /**
   * Create a new repository
   */
  async createRepo(data: CreateRepoRequest): Promise<Repository> {
    const response = await this.request<RepoResponse>("/api/repos", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return this.mapRepoResponse(response);
  }

  /**
   * Delete a repository
   */
  async deleteRepo(id: string): Promise<void> {
    await this.request<void>(`/api/repos/${id}`, {
      method: "DELETE",
    });
  }

  /**
   * Map API response to Repository type
   */
  private mapRepoResponse(response: RepoResponse): Repository {
    return {
      id: response.id,
      name: response.name,
      path: response.path,
      url: response.url,
      createdAt: new Date(response.createdAt),
      lastUsed: response.lastUsed ? new Date(response.lastUsed) : undefined,
    };
  }
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

// Singleton instance
let apiClient: ApiClient | null = null;

/**
 * Get or create API client instance
 */
export function getApiClient(options?: ApiClientOptions): ApiClient {
  if (!apiClient && options) {
    apiClient = new ApiClient(options);
  }

  if (!apiClient) {
    // Default to environment variable or localhost
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    apiClient = new ApiClient({ baseUrl });
  }

  return apiClient;
}

/**
 * Reset API client (useful for testing or logout)
 */
export function resetApiClient(): void {
  apiClient = null;
}

export default ApiClient;
