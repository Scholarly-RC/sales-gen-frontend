"use client";

import { format } from "date-fns";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronsUpDown,
  FileOutput,
  LoaderCircle,
  Pencil,
  PlusCircle,
  Power,
  RefreshCw,
  Square,
  Trash2,
  View,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DashboardItems } from "@/components/workspace/dashboard-items";
import { MonthSelect } from "@/components/workspace/month-select";
import { ClientExpensesSection } from "@/components/workspace/sections/client-expenses-section";
import { ClientSalesSection } from "@/components/workspace/sections/client-sales-section";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { useCatalogActions } from "@/hooks/workspace/use-catalog-actions";
import { useCatalogData } from "@/hooks/workspace/use-catalog-data";
import { useClientActions } from "@/hooks/workspace/use-client-actions";
import {
  EXPENSE_TYPE_OPTIONS,
  useClientExpenseActions,
  VAT_STATUS_OPTIONS,
} from "@/hooks/workspace/use-client-expense-actions";
import { useClientSalesActions } from "@/hooks/workspace/use-client-sales-actions";
import { useOcrJobActions } from "@/hooks/workspace/use-ocr-job-actions";
import { useOcrJobs } from "@/hooks/workspace/use-ocr-jobs";
import { useUserActions } from "@/hooks/workspace/use-user-actions";
import { useWorkspaceData } from "@/hooks/workspace/use-workspace-data";
import { useWorkspaceToken } from "@/hooks/workspace/use-workspace-token";
import { clearAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/http";
import { getExpensePreviewStickyClass } from "@/lib/workspace/expense-preview";
import type { ClientFormValues, UserFormValues } from "@/lib/workspace/schemas";
import {
  calculateSaleItemLineTotal,
  formatDate,
  formatDiscountDisplay,
  normalizeDateKey,
} from "@/lib/workspace/utils";
import type {
  ClientExpenseType,
  ClientExport,
  WorkspaceSection,
} from "@/types/workspace";

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  return apiRequest<T>(path, { token, init });
}

const NO_CLIENT_VALUE = "__none__";
const ACTIVE_DATE_STORAGE_KEY = "sales-gen-active-date";
const PREVIEW_TOTAL_LABELS = new Set([
  "total sales from order slip",
  "total summary of sales",
  "total discount",
  "variance",
]);
const DISABLE_PROCESS_OCR_SALE = true;

function toPreviewTotalLabel(value: string) {
  return value.trim().toLowerCase();
}

function parsePreviewNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPreviewTotalValue(row: Array<string | number>) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    const parsed = parsePreviewNumber(row[index]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function normalizeColumnLabel(value: string) {
  return value.trim().toLowerCase();
}

function getPreviewColumnWidthClass(column: string) {
  const normalized = normalizeColumnLabel(column);
  if (normalized === "item") return "w-[280px] min-w-[280px]";
  if (normalized === "quantity") return "w-[110px] min-w-[110px]";
  if (normalized === "unit price") return "w-[130px] min-w-[130px]";
  if (normalized === "line total") return "w-[140px] min-w-[140px]";
  return "w-[150px] min-w-[150px]";
}

const EXPENSE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_TYPE_OPTIONS.map((entry) => [entry.value, entry.label]),
) as Record<ClientExpenseType, string>;

export function WorkspaceShell({ section }: { section: WorkspaceSection }) {
  const router = useRouter();
  const [activeDate, setActiveDate] = useState("");
  const [isActiveDatePopoverOpen, setIsActiveDatePopoverOpen] = useState(false);
  const [isSalesFilterPopoverOpen, setIsSalesFilterPopoverOpen] =
    useState(false);

  const { token, status } = useWorkspaceToken();
  const [isClientSaleOcrModalOpen, setIsClientSaleOcrModalOpen] =
    useState(false);
  const [isClientSalesExportModalOpen, setIsClientSalesExportModalOpen] =
    useState(false);
  const [isClientSalesPreviewModalOpen, setIsClientSalesPreviewModalOpen] =
    useState(false);
  const [isClientExpensesExportModalOpen, setIsClientExpensesExportModalOpen] =
    useState(false);
  const [
    isClientExpensesPreviewModalOpen,
    setIsClientExpensesPreviewModalOpen,
  ] = useState(false);
  const [activePreviewSheetName, setActivePreviewSheetName] = useState("");
  const [isCatalogCategoriesModalOpen, setIsCatalogCategoriesModalOpen] =
    useState(false);
  const [selectedSalePreview, setSelectedSalePreview] =
    useState<ClientExport | null>(null);

  const [activeItemSuggestionRowId, setActiveItemSuggestionRowId] = useState<
    string | null
  >(null);

  const handleAuthFailure = useCallback(() => {
    clearAuthToken();
  }, []);

  const {
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
    refreshExports,
  } = useWorkspaceData({
    token: status === "authenticated" ? token : null,
    section,
    request,
    onAuthFailure: handleAuthFailure,
  });

  const {
    catalogItems,
    catalogCategories,
    catalogCategoriesPageRows,
    catalogSearch,
    catalogPage,
    catalogTotalPages,
    catalogTotalItems,
    categoriesPage,
    categoriesTotalPages,
    categoriesTotalItems,
    isLoadingCategoriesPage,
    catalogItemSuggestions,
    suggestionQuery,
    isLoadingCatalogItems,
    catalogLoadError,
    setCatalogItems,
    setCatalogCategories,
    setCatalogSearch,
    setCatalogPage,
    setCatalogTotalPages,
    setCatalogTotalItems,
    setCategoriesPage,
    setCatalogItemSuggestions,
    setSuggestionQuery,
    setCatalogLoadError,
    loadCatalogItems,
    loadCatalogCategories,
    loadCatalogCategoriesPage,
  } = useCatalogData({
    token,
    section,
    selectedClientId,
    isCatalogCategoriesModalOpen,
    activeItemSuggestionRowId,
    request,
  });

  const {
    selectedCatalogItem,
    isCatalogItemModalOpen,
    isCategoryComboboxOpen,
    isDeleteCatalogItemModalOpen,
    isDeleteCategoryModalOpen,
    catalogItemPendingDelete,
    categoryPendingDelete,
    isSavingCatalogItem,
    isDeletingCatalogItem,
    isSavingCategory,
    isDeletingCategory,
    catalogItemFormError,
    catalogItemForm,
    categoryFormName,
    categoryFormError,
    selectedCategory,
    selectedCatalogCategoryLabel,
    setIsCatalogItemModalOpen,
    setIsCategoryComboboxOpen,
    setIsDeleteCatalogItemModalOpen,
    setIsDeleteCategoryModalOpen,
    setCatalogItemPendingDelete,
    setCategoryPendingDelete,
    setCatalogItemFormError,
    setCatalogItemForm,
    setCategoryFormName,
    setCategoryFormError,
    setSelectedCategory,
    setSelectedCatalogItem,
    openCatalogItemCreateModal,
    openCatalogItemEditModal,
    handleSaveCatalogItem,
    handleCreateOrUpdateCategory,
    handleDeleteCategory,
    openDeleteCatalogItemModal,
    handleDeleteCatalogItem,
  } = useCatalogActions({
    token,
    selectedClientId,
    catalogItems,
    catalogCategories,
    catalogSearch,
    catalogPage,
    categoriesPage,
    isCatalogCategoriesModalOpen,
    setIsCatalogCategoriesModalOpen,
    request,
    setCatalogPage,
    loadCatalogItems,
    loadCatalogCategories,
    loadCatalogCategoriesPage,
  });

  const {
    ocrJobs,
    isOcrQueueHidden,
    activeQueueCount,
    setOcrJobs,
    setIsOcrQueueHidden,
  } = useOcrJobs({
    token: status === "authenticated" ? token : null,
    enabled: Boolean(user) && !DISABLE_PROCESS_OCR_SALE,
    request,
  });

  const {
    handleRetryFailedOcrJob,
    handleStopQueuedOcrJob,
    handleRemoveFinishedOcrJobs,
  } = useOcrJobActions({
    token: status === "authenticated" ? token : null,
    request,
    setOcrJobs,
  });

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

  const {
    selectedClient,
    isClientModalOpen,
    isDeleteClientModalOpen,
    clientPendingDelete,
    isSavingClient,
    isDeletingClient,
    salesTemplateFile,
    expensesTemplateFile,
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
  } = useClientActions({
    token,
    request,
    clientForm,
    setClients,
    setSelectedClientId,
  });

  const {
    selectedUser,
    isUserModalOpen,
    isSavingUser,
    userFormError,
    setIsUserModalOpen,
    setUserFormError,
    openUserCreateModal,
    openUserEditModal,
    submitUserForm,
    handleDeleteUser,
    handleActivateUser,
  } = useUserActions({
    token,
    request,
    userForm,
    setUsers,
  });

  const {
    saleImages,
    salesFilterDate,
    saleImagesError,
    isExportingClientSales,
    isLoadingClientSalesPreview,
    exportMonth,
    exportYear,
    clientSalesPreview,
    isRunningOcr,
    saleDate,
    saleTransactionPeriod,
    saleDiscountType,
    saleDiscountValue,
    saleNotes,
    saleItems,
    isSavingClientSale,
    isClientSaleModalOpen,
    dailySummarySalesInput,
    isSavingDailySummarySales,
    editingSaleId,
    saleItemsSubtotal,
    saleDiscountAmount,
    saleItemsGrandTotal,
    filteredExports,
    filteredItemSuggestions,
    setSalesFilterDate,
    setSaleImages,
    setSaleImagesError,
    setExportMonth,
    setExportYear,
    setSaleDate,
    setSaleTransactionPeriod,
    setSaleDiscountType,
    setSaleDiscountValue,
    setSaleNotes,
    setSaleItems,
    setDailySummarySalesInput,
    setIsClientSaleModalOpen,
    handleProcessSales,
    addSaleItem,
    updateSaleItem,
    removeSaleItem,
    resetClientSaleForm,
    openEditClientSaleModal,
    handleSubmitClientSaleForm,
    handleExportClientSalesByMonth,
    handlePreviewClientSalesByMonth,
    handleSaveDailySummarySales,
    setClientSalesPreview,
    handleSaleImagesChange,
  } = useClientSalesActions({
    token,
    selectedClientId,
    request,
    exports,
    refreshExports,
    catalogItemSuggestions,
    setCatalogItemSuggestions,
    setSuggestionQuery,
    setActiveItemSuggestionRowId,
  });
  const {
    expenses,
    isLoadingExpenses,
    isExpenseModalOpen,
    selectedExpense,
    isSavingExpense,
    isDeletingExpense,
    expensePendingDelete,
    isDeleteExpenseModalOpen,
    expenseDate,
    expenseLines,
    expensePreviewMonth,
    expensePreviewYear,
    expensePreviewRows,
    expensePreviewColumns,
    expensePreviewTotalsRow,
    expenseFilterDate,
    isLoadingClientExpensesPreview,
    isExportingClientExpenses,
    filteredExpenses,
    setIsExpenseModalOpen,
    setExpensePendingDelete,
    setIsDeleteExpenseModalOpen,
    setExpenseDate,
    setExpensePreviewMonth,
    setExpensePreviewYear,
    setExpenseFilterDate,
    resetExpenseForm,
    openCreateExpenseModal,
    openEditExpenseModal,
    addExpenseLine,
    updateExpenseLine,
    removeExpenseLine,
    handleSaveExpense,
    handleDeleteExpense,
    handlePreviewClientExpensesByMonth,
    handleExportClientExpensesByMonth,
  } = useClientExpenseActions({
    token,
    section,
    selectedClientId,
    request,
  });

  const selectedSalesClient = useMemo(
    () => clients.find((entry) => entry.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const salesDatesWithData = useMemo(() => {
    const uniqueDates = new Set<string>();
    for (const entry of exports) {
      const dateKey = normalizeDateKey(entry.sale_date);
      if (dateKey) {
        uniqueDates.add(dateKey);
      }
    }
    return Array.from(uniqueDates).map(
      (dateKey) => new Date(`${dateKey}T00:00:00`),
    );
  }, [exports]);
  const expenseDatesWithData = useMemo(() => {
    const uniqueDates = new Set<string>();
    for (const entry of expenses) {
      const dateKey = normalizeDateKey(entry.transaction_date);
      if (dateKey) {
        uniqueDates.add(dateKey);
      }
    }
    return Array.from(uniqueDates).map(
      (dateKey) => new Date(`${dateKey}T00:00:00`),
    );
  }, [expenses]);
  const activePreviewSheet = useMemo(() => {
    if (!clientSalesPreview?.sheets.length) {
      return null;
    }
    return (
      clientSalesPreview.sheets.find(
        (sheet) => sheet.name === activePreviewSheetName,
      ) ?? clientSalesPreview.sheets[0]
    );
  }, [activePreviewSheetName, clientSalesPreview]);
  const activePreviewSheetRows = useMemo(() => {
    if (!activePreviewSheet) {
      return { lineRows: [], totalRows: [] } as const;
    }

    const lineRows: Array<Array<string | number>> = [];
    const totalRows: Array<Array<string | number>> = [];

    for (const row of activePreviewSheet.rows) {
      const hasTotalLabel = row.some((cell) => {
        if (typeof cell !== "string") {
          return false;
        }
        return PREVIEW_TOTAL_LABELS.has(cell.trim().toLowerCase());
      });

      if (hasTotalLabel) {
        totalRows.push(row);
      } else {
        lineRows.push(row);
      }
    }

    return { lineRows, totalRows } as const;
  }, [activePreviewSheet]);
  const activePreviewLineTable = useMemo(() => {
    if (!activePreviewSheet) {
      return { columns: [], rows: [], originalIndexes: [] } as const;
    }

    const lineTotalColumnIndex = activePreviewSheet.columns.findIndex(
      (column) => normalizeColumnLabel(column) === "line total",
    );
    const endIndex =
      lineTotalColumnIndex >= 0
        ? lineTotalColumnIndex + 1
        : activePreviewSheet.columns.length;

    const originalIndexes = Array.from(
      { length: endIndex },
      (_, index) => index,
    ).filter((index) => {
      const label = normalizeColumnLabel(
        activePreviewSheet.columns[index] ?? "",
      );
      return label !== "sale id" && label !== "period";
    });
    const columns = originalIndexes.map(
      (index) => activePreviewSheet.columns[index],
    );
    const rows = activePreviewSheetRows.lineRows.map((row) =>
      originalIndexes.map((index) => row[index]),
    );
    return { columns, rows, originalIndexes } as const;
  }, [activePreviewSheet, activePreviewSheetRows.lineRows]);
  const activePreviewColumnIndexes = useMemo(() => {
    if (!activePreviewSheet) {
      return {
        period: -1,
        lineTotal: -1,
        subtotal: -1,
        grandTotal: -1,
        discountType: -1,
        discountValue: -1,
        notes: -1,
      } as const;
    }

    const columns = activePreviewSheet.columns.map((column) =>
      normalizeColumnLabel(column),
    );
    return {
      period: columns.indexOf("period"),
      lineTotal: columns.indexOf("line total"),
      subtotal: columns.indexOf("subtotal"),
      grandTotal: columns.indexOf("grand total"),
      discountType: columns.indexOf("discount type"),
      discountValue: columns.indexOf("discount value"),
      notes: columns.indexOf("notes"),
    } as const;
  }, [activePreviewSheet]);
  const previewPeriodGroups = useMemo(() => {
    const originalIndexes = activePreviewLineTable.originalIndexes;
    const groups = new Map<
      string,
      {
        label: string;
        rowsFull: Array<Array<string | number>>;
        rowsTrimmed: Array<Array<string | number>>;
      }
    >();

    for (const row of activePreviewSheetRows.lineRows) {
      let periodLabel = "Other";
      if (activePreviewColumnIndexes.period >= 0) {
        const raw = String(row[activePreviewColumnIndexes.period] ?? "")
          .trim()
          .toUpperCase();
        if (raw === "AM" || raw === "PM") {
          periodLabel = raw;
        } else if (raw) {
          periodLabel = raw;
        }
      }

      const existing = groups.get(periodLabel);
      if (existing) {
        existing.rowsFull.push(row);
        existing.rowsTrimmed.push(originalIndexes.map((index) => row[index]));
      } else {
        groups.set(periodLabel, {
          label: periodLabel,
          rowsFull: [row],
          rowsTrimmed: [originalIndexes.map((index) => row[index])],
        });
      }
    }

    const preferredOrder = ["AM", "PM"];
    const ordered = Array.from(groups.entries()).sort((a, b) => {
      const left = preferredOrder.indexOf(a[0]);
      const right = preferredOrder.indexOf(b[0]);
      if (left === -1 && right === -1) return a[0].localeCompare(b[0]);
      if (left === -1) return 1;
      if (right === -1) return -1;
      return left - right;
    });
    return ordered.map(([, group]) => group);
  }, [
    activePreviewColumnIndexes.period,
    activePreviewLineTable.originalIndexes,
    activePreviewSheetRows.lineRows,
  ]);
  const activePreviewLineSummary = useMemo(() => {
    if (!activePreviewSheet) {
      return {
        totalSalesFromOrderSlip: null,
        discountType: null,
        discountValue: null,
        totalDiscount: null,
        notes: null,
      } as const;
    }

    let totalSalesFromOrderSlip = 0;
    let hasLineTotal = false;

    for (const row of activePreviewSheetRows.lineRows) {
      const lineTotal =
        activePreviewColumnIndexes.lineTotal >= 0
          ? parsePreviewNumber(row[activePreviewColumnIndexes.lineTotal])
          : null;
      if (lineTotal !== null) {
        totalSalesFromOrderSlip += lineTotal;
        hasLineTotal = true;
      }
    }

    const firstRow = activePreviewSheetRows.lineRows[0] ?? null;
    const subtotal =
      firstRow && activePreviewColumnIndexes.subtotal >= 0
        ? parsePreviewNumber(firstRow[activePreviewColumnIndexes.subtotal])
        : null;
    const grandTotal =
      firstRow && activePreviewColumnIndexes.grandTotal >= 0
        ? parsePreviewNumber(firstRow[activePreviewColumnIndexes.grandTotal])
        : null;
    const discountType =
      firstRow && activePreviewColumnIndexes.discountType >= 0
        ? String(
            firstRow[activePreviewColumnIndexes.discountType] ?? "",
          ).trim() || null
        : null;
    const discountValue =
      firstRow && activePreviewColumnIndexes.discountValue >= 0
        ? parsePreviewNumber(firstRow[activePreviewColumnIndexes.discountValue])
        : null;
    const notes =
      firstRow && activePreviewColumnIndexes.notes >= 0
        ? String(firstRow[activePreviewColumnIndexes.notes] ?? "").trim() ||
          null
        : null;
    const totalDiscount =
      subtotal !== null && grandTotal !== null ? subtotal - grandTotal : null;

    return {
      totalSalesFromOrderSlip: hasLineTotal ? totalSalesFromOrderSlip : null,
      discountType,
      discountValue,
      totalDiscount,
      notes,
    } as const;
  }, [
    activePreviewColumnIndexes.discountType,
    activePreviewColumnIndexes.discountValue,
    activePreviewColumnIndexes.grandTotal,
    activePreviewColumnIndexes.lineTotal,
    activePreviewColumnIndexes.notes,
    activePreviewColumnIndexes.subtotal,
    activePreviewSheet,
    activePreviewSheetRows.lineRows,
  ]);
  const activePreviewSheetTotals = useMemo(() => {
    let totalSalesFromOrderSlip: number | null = null;
    let totalSummaryOfSales: number | null = null;
    let totalDiscount: number | null = null;
    let variance: number | null = null;

    for (const row of activePreviewSheetRows.totalRows) {
      const labelCell = row.find((cell) => typeof cell === "string");
      if (!labelCell) {
        continue;
      }
      const value = getPreviewTotalValue(row);
      const label = toPreviewTotalLabel(labelCell);

      if (label === "total sales from order slip") {
        totalSalesFromOrderSlip = value;
      } else if (label === "total summary of sales") {
        totalSummaryOfSales = value;
      } else if (label === "total discount") {
        totalDiscount = value;
      } else if (label === "variance") {
        variance = value;
      }
    }

    return {
      totalSalesFromOrderSlip:
        totalSalesFromOrderSlip ??
        activePreviewLineSummary.totalSalesFromOrderSlip,
      totalSummaryOfSales,
      totalDiscount: totalDiscount ?? activePreviewLineSummary.totalDiscount,
      variance,
    } as const;
  }, [activePreviewLineSummary, activePreviewSheetRows.totalRows]);
  const manualSummaryOfSales = useMemo(
    () => parsePreviewNumber(dailySummarySalesInput),
    [dailySummarySalesInput],
  );
  const displayedSummaryOfSales =
    activePreviewSheetTotals.totalSummaryOfSales ?? manualSummaryOfSales;
  const computedVariance = useMemo(() => {
    if (
      activePreviewSheetTotals.totalSalesFromOrderSlip === null ||
      activePreviewSheetTotals.totalDiscount === null ||
      displayedSummaryOfSales === null
    ) {
      return null;
    }

    return (
      displayedSummaryOfSales +
      activePreviewSheetTotals.totalDiscount -
      activePreviewSheetTotals.totalSalesFromOrderSlip
    );
  }, [
    activePreviewSheetTotals.totalDiscount,
    activePreviewSheetTotals.totalSalesFromOrderSlip,
    displayedSummaryOfSales,
  ]);
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

  useEffect(() => {
    const defaultDate = format(new Date(), "yyyy-MM-dd");
    const storedDate = window.sessionStorage.getItem(ACTIVE_DATE_STORAGE_KEY);
    setActiveDate(storedDate ?? defaultDate);
  }, []);

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    window.sessionStorage.setItem(ACTIVE_DATE_STORAGE_KEY, activeDate);
  }, [activeDate]);

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    setSalesFilterDate(new Date(`${activeDate}T00:00:00`));
    setExpenseFilterDate(new Date(`${activeDate}T00:00:00`));
  }, [activeDate, setExpenseFilterDate, setSalesFilterDate]);

  async function handleLogout() {
    try {
      await apiRequest<void>("/auth/logout", {
        init: { method: "POST" },
      });
    } catch {
      // Local auth state should still be cleared even if server logout fails.
    }
    clearAuthToken();
    router.replace("/login");
  }

  const pageTitle =
    section === "dashboard"
      ? "Dashboard Items"
      : section === "clients"
        ? "Clients"
        : section === "client-sales"
          ? "Client Sales"
          : section === "client-expenses"
            ? "Client Expenses"
            : section === "catalog"
              ? "Catalog"
              : "Users";

  function handleClientChange(value: string) {
    setSelectedClientId(value === NO_CLIENT_VALUE ? null : value);
    setCatalogItems([]);
    setCatalogCategories([]);
    setCatalogLoadError(null);
    setCatalogSearch("");
    setCatalogPage(1);
    setCatalogTotalPages(1);
    setCatalogTotalItems(0);
  }

  function handleOpenCreateSaleModal() {
    resetClientSaleForm();
    setSaleDate(activeDate);
    setIsClientSaleModalOpen(true);
  }

  function handleOpenCreateExpenseModal() {
    openCreateExpenseModal();
    setExpenseDate(activeDate);
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Restoring session...
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

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
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="grid w-full min-w-56 gap-1.5 sm:w-56">
                <Label htmlFor="active-client" className="text-xs">
                  Active Client
                </Label>
                <Select
                  value={selectedClientId ?? NO_CLIENT_VALUE}
                  onValueChange={handleClientChange}
                >
                  <SelectTrigger id="active-client" className="w-full">
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
              <div className="grid w-full min-w-56 gap-1.5 sm:w-56">
                <Label htmlFor="active-date" className="text-xs">
                  Active Date
                </Label>
                <Popover
                  open={isActiveDatePopoverOpen}
                  onOpenChange={setIsActiveDatePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="active-date"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarDays className="size-4" />
                      {activeDate ? (
                        format(new Date(`${activeDate}T00:00:00`), "PPP")
                      ) : (
                        <span>Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={
                        activeDate
                          ? new Date(`${activeDate}T00:00:00`)
                          : undefined
                      }
                      onSelect={(date) => {
                        if (!date) {
                          return;
                        }
                        setActiveDate(format(date, "yyyy-MM-dd"));
                        setIsActiveDatePopoverOpen(false);
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
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
              <WorkspaceNav section={section} onSignOut={handleLogout} />
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
              <ClientSalesSection
                isSalesFilterPopoverOpen={isSalesFilterPopoverOpen}
                setIsSalesFilterPopoverOpen={setIsSalesFilterPopoverOpen}
                salesFilterDate={salesFilterDate}
                setSalesFilterDate={setSalesFilterDate}
                salesDatesWithData={salesDatesWithData}
                setActiveDate={setActiveDate}
                selectedSalesClient={selectedSalesClient}
                setIsClientSalesExportModalOpen={
                  setIsClientSalesExportModalOpen
                }
                setIsClientSaleOcrModalOpen={setIsClientSaleOcrModalOpen}
                disableProcessOcrSale={DISABLE_PROCESS_OCR_SALE}
                handleOpenCreateSaleModal={handleOpenCreateSaleModal}
                dailySummarySalesInput={dailySummarySalesInput}
                setDailySummarySalesInput={setDailySummarySalesInput}
                handleSaveDailySummarySales={handleSaveDailySummarySales}
                isSavingDailySummarySales={isSavingDailySummarySales}
                isLoadingExports={isLoadingExports}
                filteredExports={filteredExports}
                setSelectedSalePreview={setSelectedSalePreview}
                openEditClientSaleModal={openEditClientSaleModal}
              />
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

            {!isLoadingWorkspace && section === "client-expenses" ? (
              <ClientExpensesSection
                isSalesFilterPopoverOpen={isSalesFilterPopoverOpen}
                setIsSalesFilterPopoverOpen={setIsSalesFilterPopoverOpen}
                expenseFilterDate={expenseFilterDate}
                setExpenseFilterDate={setExpenseFilterDate}
                expenseDatesWithData={expenseDatesWithData}
                setIsClientExpensesExportModalOpen={
                  setIsClientExpensesExportModalOpen
                }
                selectedClientId={selectedClientId}
                handleOpenCreateExpenseModal={handleOpenCreateExpenseModal}
                isLoadingExpenses={isLoadingExpenses}
                filteredExpenses={filteredExpenses}
                expenseTypeLabels={EXPENSE_TYPE_LABELS}
                openEditExpenseModal={openEditExpenseModal}
                setExpensePendingDelete={setExpensePendingDelete}
                setIsDeleteExpenseModalOpen={setIsDeleteExpenseModalOpen}
              />
            ) : null}

            {!isLoadingWorkspace && section === "catalog" ? (
              <div className="space-y-5">
                <div className="flex justify-end">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCategoriesPage(1);
                        setIsCatalogCategoriesModalOpen(true);
                        setCategoryFormError(null);
                      }}
                      disabled={!selectedClientId}
                    >
                      <BookOpen className="size-4" />
                      Manage Categories
                    </Button>
                    <Button
                      type="button"
                      onClick={openCatalogItemCreateModal}
                      disabled={!selectedClientId}
                    >
                      <PlusCircle className="size-4" />
                      Add Item
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="catalog-search">Search</Label>
                  <Input
                    id="catalog-search"
                    value={catalogSearch}
                    onChange={(event) => {
                      setCatalogSearch(event.target.value);
                      setCatalogPage(1);
                    }}
                    placeholder="Search item, category, or price"
                    disabled={!selectedClientId || isLoadingCatalogItems}
                  />
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="w-[180px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingCatalogItems ? (
                        [
                          "catalog-skeleton-1",
                          "catalog-skeleton-2",
                          "catalog-skeleton-3",
                          "catalog-skeleton-4",
                          "catalog-skeleton-5",
                          "catalog-skeleton-6",
                        ].map((key) => (
                          <TableRow key={key}>
                            <TableCell>
                              <Skeleton className="h-4 w-40" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-56" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="ml-auto h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-8 w-28" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : catalogItems.length ? (
                        catalogItems.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.category_name ?? "-"}</TableCell>
                            <TableCell>{row.item_name}</TableCell>
                            <TableCell className="text-right">
                              {row.unit_price !== null
                                ? Number(row.unit_price).toFixed(2)
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openCatalogItemEditModal(row)}
                                >
                                  <Pencil className="size-4" /> Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    openDeleteCatalogItemModal(row)
                                  }
                                >
                                  <Trash2 className="size-4" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground"
                          >
                            No catalog items found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {catalogTotalItems} items total
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={catalogPage <= 1 || isLoadingCatalogItems}
                      onClick={() =>
                        setCatalogPage((previous) => Math.max(1, previous - 1))
                      }
                    >
                      Previous
                    </Button>
                    {isLoadingCatalogItems ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Page {catalogPage} of {catalogTotalPages}
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        catalogPage >= catalogTotalPages ||
                        isLoadingCatalogItems
                      }
                      onClick={() =>
                        setCatalogPage((previous) =>
                          Math.min(catalogTotalPages, previous + 1),
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
                {catalogLoadError ? (
                  <p className="text-sm text-destructive">{catalogLoadError}</p>
                ) : null}
              </div>
            ) : null}
          </article>
        </section>
      </main>

      {activeQueueCount > 0 && isOcrQueueHidden ? (
        <div className="fixed right-4 bottom-4 z-40">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsOcrQueueHidden(false)}
          >
            Show OCR Queue ({activeQueueCount})
          </Button>
        </div>
      ) : null}

      {activeQueueCount > 0 && !isOcrQueueHidden ? (
        <aside className="fixed right-4 bottom-4 z-40 w-[min(92vw,380px)] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">OCR Queue</h3>
            <div className="flex items-center gap-2">
              <Badge variant="default">{activeQueueCount} active</Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsOcrQueueHidden(true)}
              >
                Hide
              </Button>
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
      ) : null}

      <Dialog
        open={isClientModalOpen}
        onOpenChange={(open) => {
          setIsClientModalOpen(open);
          if (!open) {
            setSalesTemplateFile(null);
            setExpensesTemplateFile(null);
          }
        }}
      >
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
            <div className="grid gap-2">
              <Label htmlFor="sales-template-file">
                Sales Template (.xlsx)
              </Label>
              <Input
                id="sales-template-file"
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSalesTemplateFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Current:{" "}
                {selectedClient?.sales_template_file_name ||
                  "No template uploaded"}
                {salesTemplateFile ? ` | New: ${salesTemplateFile.name}` : ""}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expenses-template-file">
                Expenses Template (.xlsx)
              </Label>
              <Input
                id="expenses-template-file"
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setExpensesTemplateFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Current:{" "}
                {selectedClient?.expenses_template_file_name ||
                  "No template uploaded"}
                {expensesTemplateFile
                  ? ` | New: ${expensesTemplateFile.name}`
                  : ""}
              </p>
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
        open={isClientSalesExportModalOpen}
        onOpenChange={(open) => {
          if (isExportingClientSales || isLoadingClientSalesPreview) {
            return;
          }
          setIsClientSalesExportModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Client Sales</DialogTitle>
            <DialogDescription>
              Select month and year for the export file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="client-sales-export-month">Month</Label>
                <MonthSelect
                  id="client-sales-export-month"
                  value={exportMonth}
                  onValueChange={setExportMonth}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-sales-export-year">Year</Label>
                <Input
                  id="client-sales-export-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={exportYear}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isNaN(parsed)) {
                      return;
                    }
                    setExportYear(parsed);
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsClientSalesExportModalOpen(false)}
                disabled={isExportingClientSales}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const payload = await handlePreviewClientSalesByMonth();
                  if (!payload) {
                    return;
                  }
                  setActivePreviewSheetName(payload.sheets[0]?.name ?? "");
                  setIsClientSalesPreviewModalOpen(true);
                }}
                disabled={
                  !selectedSalesClient ||
                  isExportingClientSales ||
                  isLoadingClientSalesPreview
                }
              >
                {isLoadingClientSalesPreview ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <View className="size-4" />
                )}
                Preview
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const didExport = await handleExportClientSalesByMonth();
                  if (didExport) {
                    setIsClientSalesExportModalOpen(false);
                  }
                }}
                disabled={
                  !selectedSalesClient ||
                  isExportingClientSales ||
                  isLoadingClientSalesPreview
                }
              >
                {isExportingClientSales ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileOutput className="size-4" />
                )}
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientSalesPreviewModalOpen}
        onOpenChange={(open) => {
          setIsClientSalesPreviewModalOpen(open);
          if (!open) {
            setClientSalesPreview(null);
            setActivePreviewSheetName("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-[96vw]">
          <DialogHeader>
            <DialogTitle>Client Sales Preview</DialogTitle>
            <DialogDescription>
              View export sheets before downloading the Excel file.
            </DialogDescription>
          </DialogHeader>
          {clientSalesPreview ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {clientSalesPreview.year}-
                  {String(clientSalesPreview.month).padStart(2, "0")} •{" "}
                  {clientSalesPreview.sheets.length} sheet(s)
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="client-sales-preview-sheet">Sheet</Label>
                  <Select
                    value={activePreviewSheet?.name ?? ""}
                    onValueChange={setActivePreviewSheetName}
                  >
                    <SelectTrigger
                      id="client-sales-preview-sheet"
                      className="w-[280px]"
                    >
                      <SelectValue placeholder="Select a sheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientSalesPreview.sheets.map((sheet) => (
                        <SelectItem key={sheet.name} value={sheet.name}>
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {clientSalesPreview.is_truncated ? (
                <p className="text-xs text-amber-600">
                  Showing first {clientSalesPreview.max_rows_per_sheet} rows per
                  sheet.
                </p>
              ) : null}

              {activePreviewSheet ? (
                <>
                  <div className="space-y-4">
                    {previewPeriodGroups.map((group) => {
                      const firstRow = group.rowsFull[0] ?? null;
                      const notes =
                        firstRow && activePreviewColumnIndexes.notes >= 0
                          ? String(
                              firstRow[activePreviewColumnIndexes.notes] ?? "",
                            ).trim() || "-"
                          : "-";
                      const discountType =
                        firstRow && activePreviewColumnIndexes.discountType >= 0
                          ? String(
                              firstRow[
                                activePreviewColumnIndexes.discountType
                              ] ?? "",
                            )
                              .trim()
                              .toLowerCase()
                          : "";
                      const discountValue =
                        firstRow &&
                        activePreviewColumnIndexes.discountValue >= 0
                          ? parsePreviewNumber(
                              firstRow[
                                activePreviewColumnIndexes.discountValue
                              ],
                            )
                          : null;
                      const subtotal =
                        firstRow && activePreviewColumnIndexes.subtotal >= 0
                          ? parsePreviewNumber(
                              firstRow[activePreviewColumnIndexes.subtotal],
                            )
                          : null;
                      const grandTotal =
                        firstRow && activePreviewColumnIndexes.grandTotal >= 0
                          ? parsePreviewNumber(
                              firstRow[activePreviewColumnIndexes.grandTotal],
                            )
                          : null;
                      const appliedDiscount =
                        subtotal !== null && grandTotal !== null
                          ? subtotal - grandTotal
                          : null;
                      const discountValueDisplay =
                        discountValue === null
                          ? "-"
                          : discountType === "percent"
                            ? `${discountValue.toFixed(2)}% (${appliedDiscount?.toFixed(2) ?? "-"})`
                            : discountValue.toFixed(2);

                      return (
                        <div key={`${activePreviewSheet.name}-${group.label}`}>
                          <p className="mb-2 text-sm font-semibold">
                            {group.label} Sales
                          </p>
                          <div className="rounded-lg border">
                            <div className="max-h-[62vh] overflow-auto">
                              <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                  <TableRow>
                                    {activePreviewLineTable.columns.map(
                                      (column) => (
                                        <TableHead
                                          key={column}
                                          className={getPreviewColumnWidthClass(
                                            column,
                                          )}
                                        >
                                          {column}
                                        </TableHead>
                                      ),
                                    )}
                                    <TableHead className="w-[220px] min-w-[220px]">
                                      Discount
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.rowsTrimmed.length ? (
                                    group.rowsTrimmed.map((row, rowIndex) => (
                                      <TableRow
                                        key={`${activePreviewSheet.name}-${group.label}-${String(row[0])}-${rowIndex}`}
                                      >
                                        {row.map((cell, cellIndex) => (
                                          <TableCell
                                            key={`${group.label}-${String(row[0])}-${activePreviewLineTable.columns[cellIndex]}`}
                                            className={getPreviewColumnWidthClass(
                                              activePreviewLineTable.columns[
                                                cellIndex
                                              ] ?? "",
                                            )}
                                          >
                                            {cell}
                                          </TableCell>
                                        ))}
                                        {rowIndex === 0 ? (
                                          <TableCell
                                            rowSpan={group.rowsTrimmed.length}
                                            className="w-[220px] min-w-[220px] align-top"
                                          >
                                            <div className="space-y-1">
                                              <p className="font-medium">
                                                {notes}
                                              </p>
                                              <p className="tabular-nums">
                                                {discountValueDisplay}
                                              </p>
                                            </div>
                                          </TableCell>
                                        ) : null}
                                      </TableRow>
                                    ))
                                  ) : (
                                    <TableRow>
                                      <TableCell
                                        colSpan={
                                          activePreviewLineTable.columns
                                            .length + 1
                                        }
                                        className="text-muted-foreground"
                                      >
                                        No line rows for this sheet.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!previewPeriodGroups.length ? (
                      <div className="rounded-lg border">
                        <p className="p-4 text-sm text-muted-foreground">
                          No line rows for this sheet.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3 rounded-lg border p-3">
                    {activePreviewSheetRows.totalRows.length ? (
                      <Table>
                        <TableBody>
                          {activePreviewSheetRows.totalRows.map(
                            (row, rowIndex) => (
                              <TableRow
                                key={`${activePreviewSheet.name}-total-${rowIndex}`}
                              >
                                {row.map((cell, cellIndex) => (
                                  <TableCell
                                    key={`${activePreviewSheet.name}-total-${rowIndex}-${cellIndex}`}
                                    className="py-1"
                                  >
                                    {cell}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    ) : null}
                    <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          Daily Summary of Sales
                        </p>
                        <p className="text-base font-semibold tabular-nums">
                          {displayedSummaryOfSales?.toFixed(2) ?? "-"}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="font-medium tabular-nums">
                          Total Sales from Order Slip:{" "}
                          {activePreviewSheetTotals.totalSalesFromOrderSlip?.toFixed(
                            2,
                          ) ?? "-"}
                        </p>
                        <p className="font-medium tabular-nums">
                          Total Discount:{" "}
                          {activePreviewSheetTotals.totalDiscount?.toFixed(2) ??
                            "-"}
                        </p>
                        <p className="text-base font-semibold tabular-nums">
                          Computed Variance:{" "}
                          {(activePreviewSheetTotals.variance ?? computedVariance)?.toFixed(
                            2,
                          ) ?? "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No preview data loaded.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientSaleOcrModalOpen}
        onOpenChange={(open) => {
          setIsClientSaleOcrModalOpen(open);
          if (!open) {
            setSaleImages([]);
            setSaleImagesError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process OCR Sale</DialogTitle>
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
                DISABLE_PROCESS_OCR_SALE ||
                isRunningOcr ||
                !selectedSalesClient ||
                !!saleImagesError
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
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientSaleModalOpen}
        onOpenChange={(open) => {
          if (isSavingClientSale) {
            return;
          }
          setIsClientSaleModalOpen(open);
          if (!open) {
            resetClientSaleForm();
          }
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {editingSaleId ? "Edit Client Sale" : "Add Client Sale"}
            </DialogTitle>
            <DialogDescription>
              {editingSaleId
                ? "Update sale details and items."
                : "Enter sale details and items in a cart-style form."}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Client</Label>
                    <Input value={selectedSalesClient?.name ?? ""} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="client-sale-date">Sale date</Label>
                    <Input
                      id="client-sale-date"
                      type="date"
                      value={saleDate}
                      onChange={(event) => setSaleDate(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Transaction Period</Label>
                  <Select
                    value={saleTransactionPeriod ?? "NONE"}
                    onValueChange={(value) =>
                      setSaleTransactionPeriod(
                        value === "NONE" ? null : (value as "AM" | "PM"),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Not set</SelectItem>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70">
                  <div className="h-80 overflow-y-auto">
                    <Table className="table-fixed">
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-24">Qty</TableHead>
                          <TableHead className="w-28">Unit Price</TableHead>
                          <TableHead className="w-28 text-right">
                            Line Total
                          </TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="min-w-0">
                              <Popover
                                open={activeItemSuggestionRowId === item.id}
                                onOpenChange={(open) => {
                                  setActiveItemSuggestionRowId(
                                    open ? item.id : null,
                                  );
                                  setSuggestionQuery(open ? item.itemName : "");
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={
                                      activeItemSuggestionRowId === item.id
                                    }
                                    className="w-full min-w-0 justify-between font-normal"
                                  >
                                    <span className="truncate text-left">
                                      {item.itemName || "Select or type item"}
                                    </span>
                                    <ChevronsUpDown className="opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="w-[min(28rem,calc(100vw-2rem))] min-w-[var(--radix-popover-trigger-width)] p-0"
                                >
                                  <Command>
                                    <CommandInput
                                      placeholder="Search or type item..."
                                      className="h-9"
                                      value={suggestionQuery}
                                      onValueChange={(value) => {
                                        setSuggestionQuery(value);
                                      }}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        No item found.
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {filteredItemSuggestions.map(
                                          (suggestion) => (
                                            <CommandItem
                                              key={`${item.id}-${suggestion.id}`}
                                              value={suggestion.item_name}
                                              onSelect={() => {
                                                setSaleItems((previous) =>
                                                  previous.map((entry) =>
                                                    entry.id !== item.id
                                                      ? entry
                                                      : {
                                                          ...entry,
                                                          itemName:
                                                            suggestion.item_name,
                                                          unitPrice:
                                                            suggestion.unit_price ??
                                                            0,
                                                        },
                                                  ),
                                                );
                                                setSuggestionQuery(
                                                  suggestion.item_name,
                                                );
                                                setActiveItemSuggestionRowId(
                                                  null,
                                                );
                                              }}
                                            >
                                              {suggestion.item_name}
                                            </CommandItem>
                                          ),
                                        )}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateSaleItem(
                                    item.id,
                                    "quantity",
                                    event.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  updateSaleItem(
                                    item.id,
                                    "unitPrice",
                                    event.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {calculateSaleItemLineTotal(item).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeSaleItem(item.id)}
                                disabled={saleItems.length === 1}
                                aria-label="Remove item"
                              >
                                <X className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button type="button" variant="outline" onClick={addSaleItem}>
                    <PlusCircle className="size-4" />
                    Add Item
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {saleItems.length} item{saleItems.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:content-start">
                <div className="grid gap-4 rounded-lg border border-border/70 p-4">
                  <p className="text-sm font-semibold">Discount</p>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label>Discount Type</Label>
                      <Select
                        value={saleDiscountType}
                        onValueChange={(value) =>
                          setSaleDiscountType(
                            value === "percent" ? "percent" : "fixed",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="percent">Percent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Discount Value</Label>
                      <Input
                        type="number"
                        min={0}
                        max={saleDiscountType === "percent" ? 100 : undefined}
                        step="0.01"
                        value={saleDiscountValue}
                        onChange={(event) =>
                          setSaleDiscountValue(Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client-sale-notes">Notes</Label>
                      <Textarea
                        id="client-sale-notes"
                        value={saleNotes}
                        placeholder="Optional notes"
                        rows={4}
                        onChange={(event) => setSaleNotes(event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 p-4 text-right text-sm font-semibold">
                  <div>Subtotal: {saleItemsSubtotal.toFixed(2)}</div>
                  <div>Discount: {saleDiscountAmount.toFixed(2)}</div>
                  <div>Total: {saleItemsGrandTotal.toFixed(2)}</div>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={isSavingClientSale}
                  onClick={() => void handleSubmitClientSaleForm()}
                >
                  {isSavingClientSale ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  {isSavingClientSale
                    ? "Saving..."
                    : editingSaleId
                      ? "Update Client Sale"
                      : "Save Client Sale"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedSalePreview)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSalePreview(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Sale Preview</DialogTitle>
            <DialogDescription>
              {selectedSalePreview
                ? `Details for sale ${selectedSalePreview.id}`
                : "Sale details"}
            </DialogDescription>
          </DialogHeader>
          {selectedSalePreview ? (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-lg border border-border/70 p-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sale ID</p>
                  <p className="text-sm font-medium">
                    {selectedSalePreview.id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="text-sm font-medium">
                    {usersWithCurrent.find(
                      (entry) => entry.id === selectedSalePreview.user_id,
                    )?.email ?? selectedSalePreview.user_id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sale Date</p>
                  <p className="text-sm font-medium">
                    {selectedSalePreview.sale_date}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-sm font-medium">
                    {formatDate(selectedSalePreview.updated_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSalePreview.items.length ? (
                      selectedSalePreview.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {item.line_total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          No sale items.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="font-semibold tabular-nums">
                      {selectedSalePreview.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs text-muted-foreground">
                      Discount Type
                    </p>
                    <p className="font-semibold capitalize">
                      {selectedSalePreview.discount_type}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs text-muted-foreground">
                      Discount Value
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatDiscountDisplay(selectedSalePreview)}
                    </p>
                  </div>
                  <div className="rounded-md border border-foreground/20 bg-background p-3">
                    <p className="text-xs text-muted-foreground">Total Sale</p>
                    <p className="text-base font-bold tabular-nums">
                      {selectedSalePreview.total.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {selectedSalePreview.notes ?? "-"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientExpensesExportModalOpen}
        onOpenChange={(open) => {
          if (isExportingClientExpenses || isLoadingClientExpensesPreview) {
            return;
          }
          setIsClientExpensesExportModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Client Expenses</DialogTitle>
            <DialogDescription>
              Select month and year for the export file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="client-expenses-export-month">Month</Label>
                <MonthSelect
                  id="client-expenses-export-month"
                  value={expensePreviewMonth}
                  onValueChange={setExpensePreviewMonth}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-expenses-export-year">Year</Label>
                <Input
                  id="client-expenses-export-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={expensePreviewYear}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isNaN(parsed)) {
                      return;
                    }
                    setExpensePreviewYear(parsed);
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsClientExpensesExportModalOpen(false)}
                disabled={isExportingClientExpenses}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const ok = await handlePreviewClientExpensesByMonth();
                  if (ok) {
                    setIsClientExpensesPreviewModalOpen(true);
                  }
                }}
                disabled={
                  !selectedClientId ||
                  isExportingClientExpenses ||
                  isLoadingClientExpensesPreview
                }
              >
                {isLoadingClientExpensesPreview ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <View className="size-4" />
                )}
                Preview
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const didExport = await handleExportClientExpensesByMonth();
                  if (didExport) {
                    setIsClientExpensesExportModalOpen(false);
                  }
                }}
                disabled={
                  !selectedClientId ||
                  isExportingClientExpenses ||
                  isLoadingClientExpensesPreview
                }
              >
                {isExportingClientExpenses ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileOutput className="size-4" />
                )}
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isClientExpensesPreviewModalOpen}
        onOpenChange={setIsClientExpensesPreviewModalOpen}
      >
        <DialogContent className="max-h-[92vh] max-w-[96vw]">
          <DialogHeader>
            <DialogTitle>Client Expenses Preview</DialogTitle>
            <DialogDescription>
              REVOLVING FUND REPLENISHMENT REPORT (Sheet 1 style).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {expensePreviewYear}-
              {String(expensePreviewMonth).padStart(2, "0")}
            </p>
            <div className="overflow-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    {expensePreviewColumns.map((column, index) => (
                      <TableHead
                        key={`preview-col-${index}-${column}`}
                        className={getExpensePreviewStickyClass(
                          index,
                          expensePreviewColumns.length,
                          "z-20",
                        )}
                      >
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensePreviewRows.length ? (
                    expensePreviewRows.map((row) => (
                      <TableRow key={row.id}>
                        {row.values.map((value, index) => (
                          <TableCell
                            key={`${row.id}-cell-${index}`}
                            className={
                              index >= 2
                                ? getExpensePreviewStickyClass(
                                    index,
                                    expensePreviewColumns.length,
                                    "z-10",
                                    true,
                                  )
                                : getExpensePreviewStickyClass(
                                    index,
                                    expensePreviewColumns.length,
                                    "z-10",
                                  )
                            }
                          >
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={expensePreviewColumns.length}
                        className="text-center text-muted-foreground"
                      >
                        No expenses found for selected month/year.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="overflow-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    {expensePreviewColumns.map((column, index) => (
                      <TableHead
                        key={`total-col-${index}-${column}`}
                        className={
                          index >= 2
                            ? getExpensePreviewStickyClass(
                                index,
                                expensePreviewColumns.length,
                                "z-20",
                                true,
                              )
                            : getExpensePreviewStickyClass(
                                index,
                                expensePreviewColumns.length,
                                "z-20",
                              )
                        }
                      >
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {expensePreviewColumns.map((column, index) => {
                      const value = expensePreviewTotalsRow[index] ?? 0;
                      const label = column.trim().toUpperCase();
                      const display =
                        index === 0
                          ? "TOTAL"
                          : index < 2
                            ? ""
                            : value.toFixed(2);
                      return (
                        <TableCell
                          key={`total-value-${index}-${column}`}
                          className={
                            label === "DATE" || label.startsWith("VOUCHER")
                              ? getExpensePreviewStickyClass(
                                  index,
                                  expensePreviewColumns.length,
                                  "z-10",
                                )
                              : getExpensePreviewStickyClass(
                                  index,
                                  expensePreviewColumns.length,
                                  "z-10",
                                  true,
                                )
                          }
                        >
                          {display}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isExpenseModalOpen}
        onOpenChange={(open) => {
          if (isSavingExpense) {
            return;
          }
          setIsExpenseModalOpen(open);
          if (!open) {
            resetExpenseForm();
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              Track expenses under the selected client.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveExpense();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="expense-date">Transaction date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-3">
              <Label>Expense Lines</Label>
              <div className="space-y-2">
                {expenseLines.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-2 rounded-lg border border-border/70 p-3 md:grid-cols-[minmax(0,1fr)_180px_140px_42px] md:items-end"
                  >
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Expense type
                      </Label>
                      <Select
                        value={line.expenseType}
                        onValueChange={(value) =>
                          updateExpenseLine(line.id, "expenseType", value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select expense type" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_TYPE_OPTIONS.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>
                              {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Amount
                      </Label>
                      <Input
                        type="number"
                        className="w-full"
                        min={0}
                        step="0.01"
                        value={line.amount}
                        onChange={(event) =>
                          updateExpenseLine(
                            line.id,
                            "amount",
                            event.target.value,
                          )
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">
                        VAT status
                      </Label>
                      <Select
                        value={line.vatStatus}
                        onValueChange={(value) =>
                          updateExpenseLine(line.id, "vatStatus", value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select VAT status" />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_STATUS_OPTIONS.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>
                              {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExpenseLine(line.id)}
                      disabled={
                        expenseLines.length === 1 || Boolean(selectedExpense)
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addExpenseLine}
                disabled={Boolean(selectedExpense)}
              >
                <PlusCircle className="size-4" />
                Add Line
              </Button>
            </div>
            <Button type="submit" disabled={isSavingExpense}>
              {isSavingExpense ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PlusCircle className="size-4" />
              )}
              {selectedExpense ? "Save Expense" : "Create Expense"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCatalogItemModalOpen}
        onOpenChange={(open) => {
          if (isSavingCatalogItem) {
            return;
          }
          setIsCatalogItemModalOpen(open);
          if (!open) {
            setSelectedCatalogItem(null);
            setCatalogItemFormError(null);
            setIsCategoryComboboxOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCatalogItem ? "Edit Catalog Item" : "Add Catalog Item"}
            </DialogTitle>
            <DialogDescription>
              Manage catalog items for the selected client.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCatalogItem();
            }}
          >
            <div className="grid gap-2">
              <Label>Category</Label>
              <Popover
                open={isCategoryComboboxOpen}
                onOpenChange={setIsCategoryComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCategoryComboboxOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedCatalogCategoryLabel}
                    </span>
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search category..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="No category"
                          data-checked={!catalogItemForm.categoryId}
                          onSelect={() => {
                            setCatalogItemForm((previous) => ({
                              ...previous,
                              categoryId: "",
                            }));
                            setIsCategoryComboboxOpen(false);
                          }}
                        >
                          No category
                        </CommandItem>
                        {catalogCategories.map((category) => (
                          <CommandItem
                            key={category.id}
                            value={category.name}
                            data-checked={
                              catalogItemForm.categoryId === category.id
                            }
                            onSelect={() => {
                              setCatalogItemForm((previous) => ({
                                ...previous,
                                categoryId: category.id,
                              }));
                              setIsCategoryComboboxOpen(false);
                            }}
                          >
                            {category.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catalog-item-name">Item name</Label>
              <Input
                id="catalog-item-name"
                value={catalogItemForm.itemName}
                onChange={(event) =>
                  setCatalogItemForm((previous) => ({
                    ...previous,
                    itemName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catalog-item-price">Unit price</Label>
              <Input
                id="catalog-item-price"
                type="number"
                min={0}
                step="0.01"
                value={catalogItemForm.unitPrice}
                onChange={(event) =>
                  setCatalogItemForm((previous) => ({
                    ...previous,
                    unitPrice: event.target.value,
                  }))
                }
              />
            </div>
            {catalogItemFormError ? (
              <p className="text-xs text-destructive">{catalogItemFormError}</p>
            ) : null}
            <Button type="submit" disabled={isSavingCatalogItem}>
              {isSavingCatalogItem ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <PlusCircle className="size-4" />
              )}
              {selectedCatalogItem ? "Save Item" : "Create Item"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCatalogCategoriesModalOpen}
        onOpenChange={(open) => {
          if (isSavingCategory || isDeletingCategory) {
            return;
          }
          setIsCatalogCategoriesModalOpen(open);
          if (!open) {
            setSelectedCategory(null);
            setCategoryFormName("");
            setCategoryFormError(null);
            setCategoriesPage(1);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Create, rename, and delete categories for this client.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateOrUpdateCategory();
            }}
          >
            <div className="flex gap-2">
              <Input
                value={categoryFormName}
                placeholder="Category name"
                onChange={(event) => setCategoryFormName(event.target.value)}
              />
              <Button type="submit" disabled={isSavingCategory}>
                {selectedCategory ? "Save" : "Add"}
              </Button>
              {selectedCategory ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory(null);
                    setCategoryFormName("");
                    setCategoryFormError(null);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
            {categoryFormError ? (
              <p className="text-xs text-destructive">{categoryFormError}</p>
            ) : null}
          </form>
          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogCategoriesPageRows.length ? (
                  catalogCategoriesPageRows.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>{category.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCategory(category);
                              setCategoryFormName(category.name);
                              setCategoryFormError(null);
                            }}
                          >
                            <Pencil className="size-4" /> Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setCategoryPendingDelete(category);
                              setIsDeleteCategoryModalOpen(true);
                            }}
                          >
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground"
                    >
                      {isLoadingCategoriesPage
                        ? "Loading categories..."
                        : "No categories yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {categoriesTotalItems} categories total
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={categoriesPage <= 1 || isLoadingCategoriesPage}
                onClick={() =>
                  setCategoriesPage((previous) => Math.max(1, previous - 1))
                }
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {categoriesPage} of {categoriesTotalPages}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  categoriesPage >= categoriesTotalPages ||
                  isLoadingCategoriesPage
                }
                onClick={() =>
                  setCategoriesPage((previous) =>
                    Math.min(categoriesTotalPages, previous + 1),
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
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
      <ConfirmationModal
        open={isDeleteCatalogItemModalOpen}
        onOpenChange={(open) => {
          if (isDeletingCatalogItem) {
            return;
          }
          setIsDeleteCatalogItemModalOpen(open);
          if (!open) {
            setCatalogItemPendingDelete(null);
          }
        }}
        title="Delete catalog item?"
        description={
          catalogItemPendingDelete
            ? `This will permanently delete "${catalogItemPendingDelete.item_name}".`
            : undefined
        }
        confirmText="Delete item"
        loading={isDeletingCatalogItem}
        onConfirm={handleDeleteCatalogItem}
      />
      <ConfirmationModal
        open={isDeleteExpenseModalOpen}
        onOpenChange={(open) => {
          if (isDeletingExpense) {
            return;
          }
          setIsDeleteExpenseModalOpen(open);
          if (!open) {
            setExpensePendingDelete(null);
          }
        }}
        title="Delete expense?"
        description={
          expensePendingDelete
            ? `This will permanently delete the expense from ${expensePendingDelete.transaction_date}.`
            : undefined
        }
        confirmText="Delete expense"
        loading={isDeletingExpense}
        onConfirm={handleDeleteExpense}
      />
      <ConfirmationModal
        open={isDeleteCategoryModalOpen}
        onOpenChange={(open) => {
          if (isDeletingCategory) {
            return;
          }
          setIsDeleteCategoryModalOpen(open);
          if (!open) {
            setCategoryPendingDelete(null);
          }
        }}
        title="Delete category?"
        description={
          categoryPendingDelete
            ? `This will permanently delete "${categoryPendingDelete.name}".`
            : undefined
        }
        confirmText="Delete category"
        loading={isDeletingCategory}
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
}
