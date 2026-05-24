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
  const [salesTemplateFile, setSalesTemplateFile] = useState<File | null>(null);
  const [expensesTemplateFile, setExpensesTemplateFile] = useState<File | null>(
    null,
  );

  function openClientCreateModal() {
    setSelectedClient(null);
    setSalesTemplateFile(null);
    setExpensesTemplateFile(null);
    clientForm.reset({ name: "", company: "", notes: "" });
    setIsClientModalOpen(true);
  }

  function openClientEditModal(client: Client) {
    setSelectedClient(client);
    setSalesTemplateFile(null);
    setExpensesTemplateFile(null);
    clientForm.reset({
      name: client.name,
      company: client.company || "",
      notes: client.notes || "",
    });
    setIsClientModalOpen(true);
  }

  async function uploadClientTemplate(
    clientId: string,
    templateKind: "sales" | "expenses",
    file: File,
  ) {
    if (!token) {
      return null;
    }

    const formData = new FormData();
    formData.append("template_file", file);

    return request<Client>(
      `/clients/${clientId}/templates/${templateKind}`,
      token,
      {
        method: "POST",
        body: formData,
      },
    );
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
      const savedClient = selectedClient
        ? await request<Client>(`/clients/${selectedClient.id}`, token, {
            method: "PUT",
            body: JSON.stringify({
              name: parsed.data.name,
              company: parsed.data.company || null,
              notes: parsed.data.notes || null,
            }),
          })
        : await request<Client>("/clients", token, {
            method: "POST",
            body: JSON.stringify({
              name: parsed.data.name,
              company: parsed.data.company || null,
              notes: parsed.data.notes || null,
            }),
          });

      let hydratedClient = savedClient;
      const templateClientId = savedClient.id;
      const uploadErrors: string[] = [];
      if (salesTemplateFile) {
        try {
          const updated = await uploadClientTemplate(
            templateClientId,
            "sales",
            salesTemplateFile,
          );
          if (updated) {
            hydratedClient = updated;
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Sales template upload failed";
          uploadErrors.push(`Sales template: ${message}`);
        }
      }
      if (expensesTemplateFile) {
        try {
          const updated = await uploadClientTemplate(
            templateClientId,
            "expenses",
            expensesTemplateFile,
          );
          if (updated) {
            hydratedClient = updated;
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Expenses template upload failed";
          uploadErrors.push(`Expenses template: ${message}`);
        }
      }

      if (selectedClient) {
        setClients((previous) =>
          previous.map((client) =>
            client.id === hydratedClient.id ? hydratedClient : client,
          ),
        );
        setSelectedClient(hydratedClient);
      } else {
        setClients((previous) => [hydratedClient, ...previous]);
      }

      setSalesTemplateFile(null);
      setExpensesTemplateFile(null);
      setIsClientModalOpen(false);
      if (uploadErrors.length) {
        appToast.error({
          title: "Client saved but template upload failed",
          description: uploadErrors.join(" | "),
        });
      }
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
    salesTemplateFile,
    expensesTemplateFile,
    setSelectedClient,
    setIsClientModalOpen,
    setIsDeleteClientModalOpen,
    setClientPendingDelete,
    setSalesTemplateFile,
    setExpensesTemplateFile,
    openClientCreateModal,
    openClientEditModal,
    submitClientForm,
    openDeleteClientModal,
    handleDeleteClient,
  };
}
