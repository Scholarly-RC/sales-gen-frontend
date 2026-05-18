"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { appToast } from "@/lib/toast";
import { type ClientFormValues, clientSchema } from "@/lib/workspace/schemas";
import type { Client, ClientExport } from "@/types/workspace";

type RequestFn = <T>(
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<T>;

type UseClientActionsParams = {
  token: string | null;
  request: RequestFn;
  clientForm: UseFormReturn<ClientFormValues>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useClientActions({
  token,
  request,
  clientForm,
  setClients,
  setSelectedClientId,
}: UseClientActionsParams) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
  const [clientPendingDelete, setClientPendingDelete] = useState<Client | null>(
    null,
  );
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  function openClientCreateModal() {
    setSelectedClient(null);
    clientForm.reset({ name: "", company: "", notes: "" });
    setIsClientModalOpen(true);
  }

  function openClientEditModal(client: Client) {
    setSelectedClient(client);
    clientForm.reset({
      name: client.name,
      company: client.company || "",
      notes: client.notes || "",
    });
    setIsClientModalOpen(true);
  }

  async function submitClientForm(values: ClientFormValues) {
    if (!token) {
      return;
    }

    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ClientFormValues;
        clientForm.setError(field, { message: issue.message });
      }
      return;
    }

    setIsSavingClient(true);

    try {
      if (selectedClient) {
        const updated = await request<Client>(
          `/clients/${selectedClient.id}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({
              name: parsed.data.name,
              company: parsed.data.company || null,
              notes: parsed.data.notes || null,
            }),
          },
        );

        setClients((previous) =>
          previous.map((client) =>
            client.id === updated.id ? updated : client,
          ),
        );
      } else {
        const created = await request<Client>("/clients", token, {
          method: "POST",
          body: JSON.stringify({
            name: parsed.data.name,
            company: parsed.data.company || null,
            notes: parsed.data.notes || null,
          }),
        });

        setClients((previous) => [created, ...previous]);
      }

      setIsClientModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save client";
      appToast.error({
        title: "Unable to save client",
        description: message,
      });
    } finally {
      setIsSavingClient(false);
    }
  }

  function openDeleteClientModal(client: Client) {
    setClientPendingDelete(client);
    setIsDeleteClientModalOpen(true);
  }

  async function handleDeleteClient() {
    if (!token) {
      return;
    }

    if (!clientPendingDelete) {
      return;
    }

    const client = clientPendingDelete;
    setIsDeletingClient(true);

    try {
      const linkedSales = await request<ClientExport[]>(
        `/clients/${client.id}/exports`,
        token,
      );

      if (linkedSales.length > 0) {
        appToast.error({
          title: "Unable to delete client",
          description:
            "Client cannot be deleted because it is referenced by client sales.",
        });
        return;
      }

      await request<void>(`/clients/${client.id}`, token, { method: "DELETE" });
      setClients((previous) =>
        previous.filter((entry) => entry.id !== client.id),
      );
      setSelectedClientId((previous) =>
        previous === client.id ? null : previous,
      );
      setClientPendingDelete(null);
      setIsDeleteClientModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete client";
      appToast.error({
        title: "Unable to delete client",
        description: message,
      });
    } finally {
      setIsDeletingClient(false);
    }
  }

  return {
    selectedClient,
    isClientModalOpen,
    isDeleteClientModalOpen,
    clientPendingDelete,
    isSavingClient,
    isDeletingClient,
    setSelectedClient,
    setIsClientModalOpen,
    setIsDeleteClientModalOpen,
    setClientPendingDelete,
    openClientCreateModal,
    openClientEditModal,
    submitClientForm,
    openDeleteClientModal,
    handleDeleteClient,
  };
}
