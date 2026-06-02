"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RequestFn } from "@/lib/http";
import { appToast } from "@/lib/toast";
import { downloadFileWithToken } from "@/lib/workspace/download";
import type {
  ClientExpense,
  ClientExpensesPreviewResponse,
  ClientExpenseType,
  ClientVatStatus,
  WorkspaceSection,
} from "@/types/workspace";

type UseClientExpenseActionsParams = {
  token: string | null;
  section: WorkspaceSection;
  selectedClientId: string | null;
  request: RequestFn;
};

export const EXPENSE_TYPE_OPTIONS: Array<{
  value: ClientExpenseType;
  label: string;
}> = [
  { value: "employee_benefits", label: "Employee Benefits" },
  { value: "fuel", label: "Fuel" },
  { value: "insurance", label: "Insurance" },
  { value: "internet", label: "Internet" },
  { value: "marketing_ads", label: "Marketing Ads" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "professional_fees", label: "Professional Fees" },
  { value: "rent", label: "Rent" },
  { value: "repairs_maintenance", label: "Repairs and Maintenance" },
  { value: "salaries_wages", label: "Salaries and Wages" },
  { value: "taxes_licenses", label: "Taxes and Licenses" },
  { value: "telephone_mobile", label: "Telephone and Mobile" },
  { value: "transportation", label: "Transportation" },
  { value: "utilities", label: "Utilities" },
];

export const VAT_STATUS_OPTIONS: Array<{
  value: ClientVatStatus;
  label: string;
}> = [
  { value: "vat", label: "VAT" },
  { value: "non_vat", label: "Non-VAT" },
];

const DEFAULT_EXPENSE_TYPE: ClientExpenseType = "employee_benefits";
const DEFAULT_VAT_STATUS: ClientVatStatus = "vat";
type ExpenseLine = {
  id: string;
  expenseType: ClientExpenseType;
  vatStatus: ClientVatStatus;
  amount: string;
};

export const EXPENSE_PREVIEW_COLUMNS = [
  "DATE",
  "VOUCHER NO.",
  ...EXPENSE_TYPE_OPTIONS.map((entry) => entry.label.toUpperCase()),
  "AMOUNT",
  "NON - VAT",
] as const;

export type ClientExpensePreviewRow = {
  id: string;
  values: Array<string | number>;
};

function createExpenseLine(): ExpenseLine {
  return {
    id: crypto.randomUUID(),
    expenseType: DEFAULT_EXPENSE_TYPE,
    vatStatus: DEFAULT_VAT_STATUS,
    amount: "",
  };
}

export function useClientExpenseActions({
  token,
  section,
  selectedClientId,
  request,
}: UseClientExpenseActionsParams) {
  const [expenses, setExpenses] = useState<ClientExpense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ClientExpense | null>(
    null,
  );
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [expensePendingDelete, setExpensePendingDelete] =
    useState<ClientExpense | null>(null);
  const [isDeleteExpenseModalOpen, setIsDeleteExpenseModalOpen] =
    useState(false);

  const [expenseDate, setExpenseDate] = useState("");
  const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([
    createExpenseLine(),
  ]);
  const [expensePreviewMonth, setExpensePreviewMonth] = useState<number>(
    () => new Date().getMonth() + 1,
  );
  const [expensePreviewYear, setExpensePreviewYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [expensePreviewRows, setExpensePreviewRows] = useState<
    ClientExpensePreviewRow[]
  >([]);
  const [expensePreviewColumns, setExpensePreviewColumns] = useState<string[]>([
    ...EXPENSE_PREVIEW_COLUMNS,
  ]);
  const [expensePreviewTotalsRow, setExpensePreviewTotalsRow] = useState<
    number[]
  >(() => Array(EXPENSE_PREVIEW_COLUMNS.length).fill(0));
  const [expenseFilterDate, setExpenseFilterDate] = useState<Date | undefined>(
    () => new Date(),
  );
  const [isLoadingClientExpensesPreview, setIsLoadingClientExpensesPreview] =
    useState(false);
  const [isExportingClientExpenses, setIsExportingClientExpenses] =
    useState(false);

  function resetExpenseForm() {
    setExpenseDate("");
    setExpenseLines([createExpenseLine()]);
    setSelectedExpense(null);
  }

  const loadExpenses = useCallback(
    async (accessToken: string, clientId: string) => {
      setIsLoadingExpenses(true);
      try {
        const rows = await request<ClientExpense[]>(
          `/clients/${clientId}/expenses`,
          accessToken,
        );
        setExpenses(rows);
      } catch {
        setExpenses([]);
      } finally {
        setIsLoadingExpenses(false);
      }
    },
    [request],
  );

  useEffect(() => {
    if (!token || section !== "client-expenses" || !selectedClientId) {
      setExpenses([]);
      return;
    }

    void loadExpenses(token, selectedClientId);
  }, [loadExpenses, section, selectedClientId, token]);

  function openCreateExpenseModal() {
    resetExpenseForm();
    setIsExpenseModalOpen(true);
  }

  function openEditExpenseModal(expense: ClientExpense) {
    setSelectedExpense(expense);
    setExpenseDate(expense.transaction_date);
    setExpenseLines([
      {
        id: crypto.randomUUID(),
        expenseType: expense.expense_type,
        vatStatus: expense.vat_status,
        amount: expense.amount.toFixed(2),
      },
    ]);
    setIsExpenseModalOpen(true);
  }

  function addExpenseLine() {
    setExpenseLines((previous) => [...previous, createExpenseLine()]);
  }

  function updateExpenseLine(
    lineId: string,
    field: "expenseType" | "vatStatus" | "amount",
    value: string,
  ) {
    setExpenseLines((previous) =>
      previous.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  }

  function removeExpenseLine(lineId: string) {
    setExpenseLines((previous) => {
      if (previous.length === 1) {
        return previous;
      }
      return previous.filter((line) => line.id !== lineId);
    });
  }

  async function handleSaveExpense() {
    if (!token || !selectedClientId || isSavingExpense) {
      return;
    }

    if (!expenseDate) {
      appToast.error({ title: "Transaction date is required" });
      return;
    }

    const normalizedLines = expenseLines.map((line) => ({
      ...line,
      parsedAmount: Number(line.amount),
    }));
    const hasInvalidAmount = normalizedLines.some(
      (line) => Number.isNaN(line.parsedAmount) || line.parsedAmount < 0,
    );
    if (hasInvalidAmount) {
      appToast.error({
        title: "Invalid amount",
        description: "Each line amount must be a non-negative number.",
      });
      return;
    }

    setIsSavingExpense(true);
    try {
      if (selectedExpense) {
        const line = normalizedLines[0];
        await request<ClientExpense>(
          `/clients/${selectedClientId}/expenses/${selectedExpense.id}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({
              transaction_date: expenseDate,
              expense_type: line.expenseType,
              amount: line.parsedAmount,
              vat_status: line.vatStatus,
            }),
          },
        );
      } else {
        await Promise.all(
          normalizedLines.map((line) =>
            request<ClientExpense>(
              `/clients/${selectedClientId}/expenses`,
              token,
              {
                method: "POST",
                body: JSON.stringify({
                  transaction_date: expenseDate,
                  expense_type: line.expenseType,
                  amount: line.parsedAmount,
                  vat_status: line.vatStatus,
                }),
              },
            ),
          ),
        );
      }

      await loadExpenses(token, selectedClientId);
      setIsExpenseModalOpen(false);
      resetExpenseForm();
      appToast.success({
        title: selectedExpense ? "Expense updated" : "Expense created",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save expense";
      appToast.error({
        title: "Failed to save expense",
        description: message,
      });
    } finally {
      setIsSavingExpense(false);
    }
  }

  async function handleDeleteExpense() {
    if (
      !token ||
      !selectedClientId ||
      !expensePendingDelete ||
      isDeletingExpense
    ) {
      return;
    }

    setIsDeletingExpense(true);
    try {
      await request<void>(
        `/clients/${selectedClientId}/expenses/${expensePendingDelete.id}`,
        token,
        { method: "DELETE" },
      );
      await loadExpenses(token, selectedClientId);
      setIsDeleteExpenseModalOpen(false);
      setExpensePendingDelete(null);
      appToast.success({ title: "Expense deleted" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete expense";
      appToast.error({
        title: "Failed to delete expense",
        description: message,
      });
    } finally {
      setIsDeletingExpense(false);
    }
  }

  const filteredExpenses = useMemo(() => {
    if (!expenseFilterDate) {
      return expenses;
    }
    const selectedDate = format(expenseFilterDate, "yyyy-MM-dd");
    return expenses.filter((entry) => entry.transaction_date === selectedDate);
  }, [expenseFilterDate, expenses]);

  async function handlePreviewClientExpensesByMonth(): Promise<boolean> {
    if (!token || !selectedClientId || isLoadingClientExpensesPreview) {
      return false;
    }
    setIsLoadingClientExpensesPreview(true);
    try {
      const payload = await request<ClientExpensesPreviewResponse>(
        `/clients/${selectedClientId}/expenses/preview?year=${expensePreviewYear}&month=${expensePreviewMonth}`,
        token,
      );
      setExpensePreviewColumns(payload.columns);
      setExpensePreviewRows(
        payload.rows.map((values, index) => ({
          id: `preview-${index}`,
          values,
        })),
      );
      setExpensePreviewTotalsRow(payload.totals_row);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to preview client expenses export";
      appToast.error({
        title: "Client expenses preview failed",
        description: message,
      });
      return false;
    } finally {
      setIsLoadingClientExpensesPreview(false);
    }
  }

  async function handleExportClientExpensesByMonth(): Promise<boolean> {
    if (
      !token ||
      !selectedClientId ||
      isExportingClientExpenses ||
      isLoadingClientExpensesPreview
    ) {
      return false;
    }

    setIsExportingClientExpenses(true);
    try {
      await downloadFileWithToken({
        token,
        path: `/clients/${selectedClientId}/expenses/export-xlsx?year=${expensePreviewYear}&month=${expensePreviewMonth}`,
        init: { method: "POST" },
        fileName: `client_expenses_${selectedClientId}_${expensePreviewYear}_${String(expensePreviewMonth).padStart(2, "0")}.xlsx`,
        errorMessage: "Unable to download monthly expense file",
      });
      const month = String(expensePreviewMonth).padStart(2, "0");
      appToast.success({
        title: "Client expenses exported",
        description: `Downloaded ${expensePreviewYear}-${month} export file.`,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to export expenses";
      appToast.error({
        title: "Client expenses export failed",
        description: message,
      });
      return false;
    } finally {
      setIsExportingClientExpenses(false);
    }
  }

  return {
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
  };
}
