import { useCallback } from "react";
import type { ApiResponse, Session, User } from "../types/index.js";

export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<Session | null> | null = null;

export function refreshSession(): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (response.status === 204) return null;
        if (!response.ok) return null;
        const payload = (await readResponse<
          ApiResponse<{ user: User; accessToken: string }>
        >(response)) as ApiResponse<{ user: User; accessToken: string }>;
        return {
          user: payload.data.user,
          accessToken: payload.data.accessToken,
        };
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const result = (await response.json()) as {
    data?: T;
    error?: { message?: string };
    success?: boolean;
  };
  if (!response.ok) {
    throw new RequestError(
      result.error?.message ?? "The request could not be completed.",
      response.status,
    );
  }
  return result as T;
}

export function useAuthenticatedRequest(
  session: Session | null,
  setSession: (value: Session | null) => void,
) {
  return useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const send = (token?: string) => {
        const headers = new Headers(init.headers);
        if (init.body && !headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        if (token) headers.set("authorization", `Bearer ${token}`);
        return fetch(path, { ...init, headers, credentials: "include" });
      };

      let response = await send(session?.accessToken);
      if (response.status === 401 && session) {
        const nextSession = await refreshSession();
        if (nextSession) {
          setSession(nextSession);
          response = await send(nextSession.accessToken);
        } else {
          setSession(null);
        }
      }
      return response;
    },
    [session, setSession],
  );
}

export function useApi(
  session: Session | null,
  setSession: (value: Session | null) => void,
) {
  const request = useAuthenticatedRequest(session, setSession);
  return useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> =>
      readResponse<T>(await request(path, init)),
    [request],
  );
}

export function useApiStream(
  session: Session | null,
  setSession: (value: Session | null) => void,
) {
  const request = useAuthenticatedRequest(session, setSession);
  return useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const response = await request(path, init);
      if (!response.ok) await readResponse(response);
      return response;
    },
    [request],
  );
}

export type ApiClient = <T>(path: string, init?: RequestInit) => Promise<T>;
export type ApiStreamClient = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;
