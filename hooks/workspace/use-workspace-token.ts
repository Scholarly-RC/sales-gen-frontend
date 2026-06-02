"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  clearAuthToken,
  getStoredAuthToken,
  subscribeToAuthTokenChanges,
} from "@/lib/auth";
import { refreshAccessToken } from "@/lib/http";

type WorkspaceAuthStatus = "loading" | "authenticated" | "unauthenticated";

export function useWorkspaceToken() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkspaceAuthStatus>("loading");

  useEffect(() => {
    let isMounted = true;

    const syncToken = () => {
      if (!isMounted) {
        return;
      }

      const storedToken = getStoredAuthToken();
      if (!storedToken) {
        setToken(null);
        setStatus("unauthenticated");
        return;
      }

      setToken(storedToken);
      setStatus("authenticated");
    };

    const resolveSession = async () => {
      const storedToken = getStoredAuthToken();
      if (storedToken) {
        if (!isMounted) {
          return;
        }
        setToken(storedToken);
        setStatus("authenticated");
        return;
      }

      const refreshedToken = await refreshAccessToken();
      if (!isMounted) {
        return;
      }

      if (refreshedToken) {
        setToken(refreshedToken);
        setStatus("authenticated");
        return;
      }

      clearAuthToken();
      setToken(null);
      setStatus("unauthenticated");
    };

    void resolveSession();
    const unsubscribe = subscribeToAuthTokenChanges(syncToken);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  return { token, status };
}
