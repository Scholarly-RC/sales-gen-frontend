"use client";

import { useCallback, useEffect, useState } from "react";

import { appToast } from "@/lib/toast";
import type {
  Client,
  ClientExport,
  User,
  WorkspaceSection,
} from "@/types/workspace";

type RequestFn = <T>(
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<T>;

type UseWorkspaceDataParams = {
  token: string | null;
  section: WorkspaceSection;
  request: RequestFn;
  onAuthFailure: () => void;
};

export function useWorkspaceData({
  token,
  section,
  request,
  onAuthFailure,
}: UseWorkspaceDataParams) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [exports, setExports] = useState<ClientExport[]>([]);

  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [isLoadingExports, setIsLoadingExports] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);

  const loadWorkspace = useCallback(
    async (accessToken: string) => {
      setIsLoadingWorkspace(true);

      try {
        const [me, clientList] = await Promise.all([
          request<User>("/auth/me", accessToken),
          request<Client[]>("/clients", accessToken),
        ]);

        setUser(me);
        setClients(clientList);
        setSelectedClientId((previous) => {
          if (previous && clientList.some((item) => item.id === previous)) {
            return previous;
          }
          return clientList[0]?.id ?? null;
        });
        setUsersLoadError(null);

        try {
          const userList = await request<User[]>("/users", accessToken);
          setUsers(userList);
        } catch (error) {
          setUsers([]);
          const message =
            error instanceof Error ? error.message : "Failed to load users";
          setUsersLoadError(message);
          appToast.error({
            title: "Unable to load users",
            description: message,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load workspace";
        appToast.error({
          title: "Failed to load workspace",
          description: message,
        });
        onAuthFailure();
      } finally {
        setIsLoadingWorkspace(false);
      }
    },
    [onAuthFailure, request],
  );

  const loadExports = useCallback(
    async (accessToken: string) => {
      if (!selectedClientId) {
        setExports([]);
        return;
      }

      setIsLoadingExports(true);

      try {
        const rows = await request<ClientExport[]>(
          `/clients/${selectedClientId}/exports`,
          accessToken,
        );
        setExports(rows);
      } catch {
        setExports([]);
      } finally {
        setIsLoadingExports(false);
      }
    },
    [request, selectedClientId],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadWorkspace(token);
  }, [loadWorkspace, token]);

  useEffect(() => {
    if (!token || section !== "client-sales") {
      return;
    }

    void loadExports(token);
  }, [loadExports, section, token]);

  const refreshExports = useCallback(async () => {
    if (!token || !selectedClientId) {
      setExports([]);
      return;
    }
    await loadExports(token);
  }, [loadExports, selectedClientId, token]);

  return {
    user,
    users,
    clients,
    selectedClientId,
    exports,
    isLoadingWorkspace,
    isLoadingExports,
    usersLoadError,
    setUsers,
    setClients,
    setSelectedClientId,
    setExports,
    refreshExports,
  };
}
