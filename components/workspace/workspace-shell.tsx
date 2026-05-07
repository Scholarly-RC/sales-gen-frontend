"use client";

import {
  ArrowUpRight,
  FileOutput,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Pencil,
  PlusCircle,
  Power,
  RefreshCw,
  Square,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthToken, getStoredAuthToken } from "@/lib/auth";
import { appToast } from "@/lib/toast";

export type WorkspaceSection =
  | "dashboard"
  | "clients"
  | "client-sales"
  | "users";

type User = {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  can_delete?: boolean;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ClientExport = {
  id: string;
  client_id: string;
  user_id: string;
  date_from: string | null;
  date_to: string | null;
  created_at: string;
  updated_at: string;
};

type OcrJobStatus = "queued" | "running" | "failed" | "done" | "stopped";

type OcrJob = {
  id: string;
  submission_id: string;
  client_id: string;
  user_id: string;
  queue_message_id: string | null;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  status: OcrJobStatus;
  extracted_text: string | null;
  raw_ocr: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type OcrParentSubmissionResponse = {
  parent_submission_id: string;
  client_id: string;
  status: "queued" | "running" | "failed" | "done";
  summary: {
    total_files: number;
    total_batches: number;
    queued: number;
    running: number;
    failed: number;
    done: number;
  };
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  error_message: string | null;
};

type OcrSalesExportResponse = {
  submission_id?: string;
  parent_submission_id?: string;
  file_name: string;
  download_path: string;
};

const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function upsertOcrJobs(current: OcrJob[], updates: OcrJob[]) {
  const map = new Map(current.map((job) => [job.id, job]));
  for (const job of updates) {
    map.set(job.id, job);
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

function buildWebSocketUrl(token: string) {
  const explicit = process.env.NEXT_PUBLIC_API_WS_URL;
  if (explicit) {
    const normalized = explicit.endsWith("/")
      ? explicit.slice(0, -1)
      : explicit;
    return `${normalized}/ws/ocr-jobs?token=${encodeURIComponent(token)}`;
  }

  const proxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";
  const wsBase = proxyTarget.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/ws/ocr-jobs?token=${encodeURIComponent(token)}`;
}

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const userSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
  is_admin: z.boolean(),
  is_active: z.boolean().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    ...(init?.headers ?? {}),
  };
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Request failed";

    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((issue: { msg?: string }) => issue?.msg)
          .filter(Boolean)
          .join(", ");
      } else if (typeof body?.message === "string") {
        detail = body.message;
      }
    } catch {
      detail = `${response.status} ${response.statusText}`;
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

const sidebarItems = [
  {
    label: "Dashboard",
    href: "/workspace/dashboard",
    key: "dashboard" as const,
    icon: LayoutDashboard,
  },
  {
    label: "Clients",
    href: "/workspace/clients",
    key: "clients" as const,
    icon: UserRound,
  },
  {
    label: "Client Sales",
    href: "/workspace/client-sales",
    key: "client-sales" as const,
    icon: FileOutput,
  },
  {
    label: "Users",
    href: "/workspace/users",
    key: "users" as const,
    icon: Users,
  },
];

const NO_CLIENT_VALUE = "__none__";

function WorkspaceNav({ section }: { section: WorkspaceSection }) {
  return (
    <nav className="grid gap-2" aria-label="Workspace navigation">
      {sidebarItems.map((item) => {
        const Icon = item.icon;

        return (
          <Button
            key={item.label}
            type="button"
            variant={item.key === section ? "secondary" : "ghost"}
            className="w-full justify-start"
            asChild
          >
            <Link href={item.href}>
              <Icon className="size-4" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

function DashboardItems({
  clients,
  salesRecords,
  users,
}: {
  clients: Client[];
  salesRecords: ClientExport[];
  users: User[];
}) {
  const activeUsers = users.filter((user) => user.is_active).length;

  const cards = [
    { label: "Total Clients", value: clients.length.toString() },
    { label: "Total Client Sales", value: salesRecords.length.toString() },
    { label: "Total Users", value: users.length.toString() },
    { label: "Active Users", value: activeUsers.toString() },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border/70 bg-background p-4"
        >
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceShell({ section }: { section: WorkspaceSection }) {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [exports, setExports] = useState<ClientExport[]>([]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isClientSaleModalOpen, setIsClientSaleModalOpen] = useState(false);
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
  const [clientPendingDelete, setClientPendingDelete] = useState<Client | null>(
    null,
  );

  const [saleImages, setSaleImages] = useState<File[]>([]);
  const [saleImagesError, setSaleImagesError] = useState<string | null>(null);
  const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
  const [processedExport, setProcessedExport] =
    useState<OcrSalesExportResponse | null>(null);
  const [isRunningOcr, setIsRunningOcr] = useState(false);

  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [isLoadingExports, setIsLoadingExports] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);

  const activeQueueCount = useMemo(
    () =>
      ocrJobs.filter(
        (job) => job.status === "queued" || job.status === "running",
      ).length,
    [ocrJobs],
  );

  const clientForm = useForm<ClientFormValues>({
    defaultValues: {
      name: "",
      company: "",
      notes: "",
    },
  });

  const userForm = useForm<UserFormValues>({
    defaultValues: {
      email: "",
      password: "",
      is_admin: false,
      is_active: true,
    },
  });

  useEffect(() => {
    const storedToken = getStoredAuthToken();
    if (!storedToken) {
      router.replace("/login");
      return;
    }

    setToken(storedToken);
  }, [router]);

  const selectedSalesClient = useMemo(
    () => clients.find((entry) => entry.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const usersWithCurrent = useMemo(() => {
    if (!user) {
      return users;
    }

    const hasCurrentUser = users.some((entry) => entry.id === user.id);
    if (hasCurrentUser) {
      return users;
    }

    return [user, ...users];
  }, [users, user]);

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
        clearAuthToken();
        router.replace("/login");
      } finally {
        setIsLoadingWorkspace(false);
      }
    },
    [router],
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
    [selectedClientId],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    loadWorkspace(token);
  }, [token, loadWorkspace]);

  useEffect(() => {
    if (!token || section !== "client-sales") {
      return;
    }

    loadExports(token);
  }, [token, section, loadExports]);

  const loadOcrJobs = useCallback(async (accessToken: string) => {
    try {
      const rows = await request<OcrJob[]>("/ocr-jobs", accessToken);
      setOcrJobs(rows);
    } catch {
      setOcrJobs([]);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadOcrJobs(token);
  }, [token, loadOcrJobs]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = new WebSocket(buildWebSocketUrl(token));

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          job?: OcrJob;
        };

        if (payload.type === "job_update" && payload.job) {
          setOcrJobs((previous) =>
            upsertOcrJobs(previous, [payload.job as OcrJob]),
          );
        }
      } catch {
        // Ignore non-JSON heartbeat messages.
      }
    };

    return () => {
      socket.close();
    };
  }, [token]);

  function handleLogout() {
    clearAuthToken();
    router.replace("/login");
    router.refresh();
  }

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

  function openUserCreateModal() {
    setSelectedUser(null);
    setUserFormError(null);
    userForm.reset({
      email: "",
      password: "",
      is_admin: false,
      is_active: true,
    });
    setIsUserModalOpen(true);
  }

  function openUserEditModal(nextUser: User) {
    setSelectedUser(nextUser);
    setUserFormError(null);
    userForm.reset({
      email: nextUser.email,
      password: "",
      is_admin: nextUser.is_admin,
      is_active: nextUser.is_active,
    });
    setIsUserModalOpen(true);
  }

  async function submitUserForm(values: UserFormValues) {
    if (!token) {
      return;
    }

    setUserFormError(null);

    if (!selectedUser && !values.password) {
      userForm.setError("password", {
        message: "Password is required for new users",
      });
      return;
    }

    const parsed = userSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof UserFormValues;
        userForm.setError(field, { message: issue.message });
      }
      return;
    }

    setIsSavingUser(true);

    try {
      if (selectedUser) {
        const updated = await request<User>(
          `/users/${selectedUser.id}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({
              email: parsed.data.email,
              is_admin: parsed.data.is_admin,
              is_active: parsed.data.is_active ?? true,
            }),
          },
        );

        setUsers((previous) =>
          previous.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      } else {
        const created = await request<User>("/users", token, {
          method: "POST",
          body: JSON.stringify({
            email: parsed.data.email,
            password: parsed.data.password,
            is_admin: parsed.data.is_admin,
          }),
        });

        setUsers((previous) => [created, ...previous]);
      }

      setIsUserModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save user";
      setUserFormError(message);
      appToast.error({
        title: "Unable to save user",
        description: message,
      });
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!token) {
      return;
    }

    try {
      await request<void>(`/users/${userId}`, token, { method: "DELETE" });
      setUsers((previous) => previous.filter((entry) => entry.id !== userId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete user";
      appToast.error({
        title: "Unable to delete user",
        description: message,
      });
    }
  }

  async function handleActivateUser(userId: string) {
    if (!token) {
      return;
    }

    try {
      const updated = await request<User>(`/users/${userId}/activate`, token, {
        method: "POST",
      });

      setUsers((previous) =>
        previous.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to activate user";
      appToast.error({
        title: "Unable to activate user",
        description: message,
      });
    }
  }

  async function handleProcessSales() {
    if (!token || !selectedClientId) {
      return;
    }

    if (!saleImages.length) {
      setSaleImagesError("Select at least one image.");
      return;
    }

    if (saleImagesError) {
      return;
    }

    setIsRunningOcr(true);
    setProcessedExport(null);

    try {
      const formData = new FormData();
      for (const image of saleImages) {
        formData.append("images", image);
      }

      const parent = await request<OcrParentSubmissionResponse>(
        `/clients/${selectedClientId}/ocr`,
        token,
        {
          method: "POST",
          body: formData,
        },
      );

      let latest: OcrParentSubmissionResponse | null = null;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latest = await request<OcrParentSubmissionResponse>(
          `/ocr-parent-submissions/${parent.parent_submission_id}`,
          token,
        );
        const done = latest.summary.done + latest.summary.failed;
        if (done >= latest.summary.total_files || latest.status === "failed") {
          break;
        }
      }

      if (latest) {
        if (latest.status === "failed") {
          throw new Error(
            latest.error_message ||
              "One or more OCR jobs failed before export.",
          );
        }

        const exported = await request<OcrSalesExportResponse>(
          `/ocr-parent-submissions/${latest.parent_submission_id}/export-xlsx`,
          token,
          {
            method: "POST",
          },
        );
        setProcessedExport(exported);
        appToast.success({
          title: "Sales processed successfully",
          description: "File is ready to download.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to process sales";
      appToast.error({
        title: "Process sales failed",
        description: message,
      });
    } finally {
      setIsRunningOcr(false);
    }
  }

  async function handleDownloadProcessedFile() {
    if (!token || !processedExport) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}${processedExport.download_path}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error("Unable to download processed sales file");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = processedExport.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to download file";
      appToast.error({
        title: "Download failed",
        description: message,
      });
    }
  }

  async function handleRetryFailedOcrJob(jobId: string) {
    if (!token) {
      return;
    }

    try {
      const updated = await request<OcrJob>(`/ocr-jobs/${jobId}/retry`, token, {
        method: "POST",
      });
      setOcrJobs((previous) => upsertOcrJobs(previous, [updated]));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to retry OCR task";
      appToast.error({
        title: "OCR retry failed",
        description: message,
      });
    }
  }

  async function handleStopQueuedOcrJob(jobId: string) {
    if (!token) {
      return;
    }

    try {
      const updated = await request<OcrJob>(`/ocr-jobs/${jobId}/stop`, token, {
        method: "POST",
      });
      setOcrJobs((previous) => upsertOcrJobs(previous, [updated]));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to stop OCR job";
      appToast.error({
        title: "Stop OCR job failed",
        description: message,
      });
    }
  }

  async function handleRemoveFinishedOcrJobs() {
    if (!token) {
      return;
    }

    try {
      await request<void>("/ocr-jobs/finished", token, {
        method: "DELETE",
      });
      setOcrJobs((previous) =>
        previous.filter(
          (entry) => entry.status === "queued" || entry.status === "running",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to remove finished OCR jobs";
      appToast.error({
        title: "Remove finished failed",
        description: message,
      });
    }
  }

  function handleSaleImagesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      setSaleImages([]);
      setSaleImagesError(null);
      return;
    }

    const hasNonImage = files.some((file) => !file.type.startsWith("image/"));
    if (hasNonImage) {
      setSaleImages([]);
      setSaleImagesError("Only image files are allowed.");
      return;
    }

    const hasOversizedFile = files.some(
      (file) => file.size > MAX_IMAGE_FILE_SIZE_BYTES,
    );
    if (hasOversizedFile) {
      setSaleImages([]);
      setSaleImagesError("Each image must be 2MB or smaller.");
      return;
    }

    setSaleImages(files);
    setSaleImagesError(null);
  }

  const pageTitle =
    section === "dashboard"
      ? "Dashboard Items"
      : section === "clients"
        ? "Clients"
        : section === "client-sales"
          ? "Client Sales"
          : "Users";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,oklch(0.92_0.06_225),transparent_45%),radial-gradient(circle_at_90%_0%,oklch(0.96_0.03_70),transparent_30%)]" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
        <section className="space-y-5 rounded-3xl border border-border/60 bg-background/75 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                Sales Gen
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {pageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Badge variant={user.is_admin ? "default" : "secondary"}>
                  <UserRound className="size-3.5" />
                  {user.is_admin ? "Admin" : "User"}
                </Badge>
              ) : null}
              <Button type="button" variant="outline" onClick={handleLogout}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
          <aside className="hidden self-start rounded-3xl border border-border/60 bg-background/80 p-5 shadow-sm backdrop-blur lg:sticky lg:top-5 lg:block">
            <h2 className="text-lg font-semibold">Navigation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quick access to workspace sections.
            </p>
            <div className="mt-4">
              <WorkspaceNav section={section} />
            </div>
          </aside>

          <article className="rounded-3xl border border-border/60 bg-background/85 p-5 shadow-sm backdrop-blur sm:p-6">
            {isLoadingWorkspace ? (
              <div className="grid gap-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-32" />
              </div>
            ) : null}

            {!isLoadingWorkspace && section === "dashboard" ? (
              <DashboardItems
                clients={clients}
                salesRecords={exports}
                users={users}
              />
            ) : null}

            {!isLoadingWorkspace && section === "clients" ? (
              <div className="space-y-5">
                <div className="flex justify-end">
                  <Button type="button" onClick={openClientCreateModal}>
                    <PlusCircle className="size-4" />
                    Add Client
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[220px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>{client.name}</TableCell>
                          <TableCell>{client.company || "-"}</TableCell>
                          <TableCell>{client.notes || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openClientEditModal(client)}
                              >
                                <Pencil className="size-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openDeleteClientModal(client)}
                              >
                                <Trash2 className="size-4" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {usersLoadError ? (
                  <p className="text-sm text-destructive">{usersLoadError}</p>
                ) : null}
              </div>
            ) : null}

            {!isLoadingWorkspace && section === "client-sales" ? (
              <div className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="client-sales-client">Client</Label>
                  <Select
                    value={selectedClientId ?? NO_CLIENT_VALUE}
                    onValueChange={(value) =>
                      setSelectedClientId(
                        value === NO_CLIENT_VALUE ? null : value,
                      )
                    }
                  >
                    <SelectTrigger id="client-sales-client" className="w-full">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={6}>
                      <SelectItem value={NO_CLIENT_VALUE}>
                        Select client
                      </SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setIsClientSaleModalOpen(true)}
                    disabled={!selectedSalesClient}
                  >
                    <PlusCircle className="size-4" />
                    Add Client Sale
                  </Button>
                </div>

                <Separator />

                <div className="overflow-hidden rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Date From</TableHead>
                        <TableHead>Date To</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingExports ? (
                        <TableRow>
                          <TableCell colSpan={6}>Loading...</TableCell>
                        </TableRow>
                      ) : exports.length ? (
                        exports.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {selectedSalesClient?.name ?? "-"}
                            </TableCell>
                            <TableCell>{entry.user_id}</TableCell>
                            <TableCell>{entry.date_from}</TableCell>
                            <TableCell>{entry.date_to}</TableCell>
                            <TableCell>
                              {formatDate(entry.created_at)}
                            </TableCell>
                            <TableCell>
                              {formatDate(entry.updated_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground"
                          >
                            No client sales records.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {!isLoadingWorkspace && section === "users" ? (
              <div className="space-y-5">
                <div className="flex justify-end">
                  <Button type="button" onClick={openUserCreateModal}>
                    <PlusCircle className="size-4" />
                    Add User
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-[280px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithCurrent.map((entry) => {
                        const isCurrentUser = user?.id === entry.id;

                        return (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.email}</TableCell>
                            <TableCell>
                              {entry.is_active ? "Active" : "Inactive"}
                            </TableCell>
                            <TableCell>
                              {entry.is_admin ? "Admin" : "User"}
                            </TableCell>
                            <TableCell>
                              {isCurrentUser ? null : (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openUserEditModal(entry)}
                                  >
                                    <Pencil className="size-4" /> Edit
                                  </Button>
                                  {entry.can_delete ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteUser(entry.id)}
                                    >
                                      <Trash2 className="size-4" /> Delete
                                    </Button>
                                  ) : !entry.is_active ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleActivateUser(entry.id)
                                      }
                                    >
                                      <Power className="size-4" /> Activate
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </article>
        </section>
      </main>

      <aside className="fixed right-4 bottom-4 z-40 w-[min(92vw,380px)] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">OCR Queue</h3>
          <div className="flex items-center gap-2">
            <Badge variant={activeQueueCount > 0 ? "default" : "secondary"}>
              {activeQueueCount} active
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRemoveFinishedOcrJobs}
            >
              <X className="size-3.5" />
              Remove finished
            </Button>
          </div>
        </div>
        <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
          {ocrJobs.length ? (
            ocrJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-border/70 p-2 text-xs"
              >
                <p className="truncate font-medium">{job.file_name}</p>
                <p className="mt-1 text-muted-foreground">
                  {job.status.toUpperCase()}
                </p>
                {job.error_message ? (
                  <p className="mt-1 line-clamp-2 text-destructive">
                    {job.error_message}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  {job.status === "queued" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleStopQueuedOcrJob(job.id)}
                    >
                      <Square className="size-3.5" />
                      Stop
                    </Button>
                  ) : null}
                  {job.status === "failed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRetryFailedOcrJob(job.id)}
                    >
                      <RefreshCw className="size-3.5" />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No queued OCR jobs yet.
            </p>
          )}
        </div>
      </aside>

      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedClient ? "Edit Client" : "Add Client"}
            </DialogTitle>
            <DialogDescription>
              {selectedClient
                ? "Update this client's details."
                : "Enter details to create a new client."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={clientForm.handleSubmit(submitClientForm)}
          >
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                {...clientForm.register("name")}
                placeholder="Client name"
              />
              {clientForm.formState.errors.name ? (
                <p className="text-xs text-destructive">
                  {clientForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Company</Label>
              <Input
                {...clientForm.register("company")}
                placeholder="Company"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input {...clientForm.register("notes")} placeholder="Notes" />
            </div>
            <Button type="submit" disabled={isSavingClient}>
              {isSavingClient ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PlusCircle className="size-4" />
              )}
              {selectedClient ? "Save Client" : "Create Client"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isUserModalOpen}
        onOpenChange={(open) => {
          setIsUserModalOpen(open);
          if (!open) {
            setUserFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? "Update this user's account settings."
                : "Create a new user account."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={userForm.handleSubmit(submitUserForm)}
          >
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                {...userForm.register("email")}
                type="email"
                placeholder="Email"
              />
              {userForm.formState.errors.email ? (
                <p className="text-xs text-destructive">
                  {userForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            {!selectedUser ? (
              <div className="grid gap-2">
                <Label>Password</Label>
                <Input
                  {...userForm.register("password")}
                  type="password"
                  placeholder="Password"
                />
                {userForm.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {userForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            <label
              htmlFor="user-is-admin"
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                id="user-is-admin"
                checked={userForm.watch("is_admin")}
                onCheckedChange={(checked) =>
                  userForm.setValue("is_admin", checked === true, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
              />
              Admin user
            </label>
            {selectedUser ? (
              <label
                htmlFor="user-is-active"
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id="user-is-active"
                  checked={userForm.watch("is_active") ?? false}
                  onCheckedChange={(checked) =>
                    userForm.setValue("is_active", checked === true, {
                      shouldDirty: true,
                      shouldTouch: true,
                    })
                  }
                />
                Active
              </label>
            ) : null}
            <Button type="submit" disabled={isSavingUser}>
              {isSavingUser ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PlusCircle className="size-4" />
              )}
              {selectedUser ? "Save User" : "Create User"}
            </Button>
            {userFormError ? (
              <p className="text-xs text-destructive">{userFormError}</p>
            ) : null}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientSaleModalOpen}
        onOpenChange={(open) => {
          setIsClientSaleModalOpen(open);
          if (!open) {
            setSaleImages([]);
            setSaleImagesError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client Sale</DialogTitle>
            <DialogDescription>
              Upload sales images and process them into an export file.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="client-sale-images">Images</Label>
              <Input
                id="client-sale-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleSaleImagesChange}
              />
              <p className="text-xs text-muted-foreground">
                Upload one or more images. Maximum size is 2MB per image.
              </p>
              {saleImagesError ? (
                <p className="text-xs text-destructive">{saleImagesError}</p>
              ) : null}
              {saleImages.length ? (
                <p className="text-xs text-muted-foreground">
                  Selected: {saleImages.map((file) => file.name).join(", ")}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              disabled={
                isRunningOcr || !selectedSalesClient || !!saleImagesError
              }
              onClick={() => void handleProcessSales()}
            >
              {isRunningOcr ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
              Process Sales
            </Button>
            {processedExport ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDownloadProcessedFile()}
              >
                Download Processed Excel
              </Button>
            ) : null}
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={isDeleteClientModalOpen}
        onOpenChange={(open) => {
          if (isDeletingClient) {
            return;
          }

          setIsDeleteClientModalOpen(open);
          if (!open) {
            setClientPendingDelete(null);
          }
        }}
        title="Delete client?"
        description={
          clientPendingDelete
            ? `This will permanently delete "${clientPendingDelete.name}".`
            : undefined
        }
        confirmText="Delete client"
        loading={isDeletingClient}
        onConfirm={handleDeleteClient}
      />
    </div>
  );
}
