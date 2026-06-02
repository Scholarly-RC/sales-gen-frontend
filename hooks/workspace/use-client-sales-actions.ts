"use client";

import { useEffect, useMemo, useState } from "react";

import type { RequestFn } from "@/lib/http";
import { appToast } from "@/lib/toast";
import { downloadFileWithToken } from "@/lib/workspace/download";
import {
  calculateSaleItemLineTotal,
  formatDateKey,
  MAX_IMAGE_FILE_SIZE_BYTES,
  normalizeDateKey,
} from "@/lib/workspace/utils";
import type {
  ClientCatalogItemSuggestion,
  ClientExport,
  ClientSaleFormItem,
  ClientSalesPreviewResponse,
  OcrParentSubmissionResponse,
} from "@/types/workspace";

type UseClientSalesActionsParams = {
  token: string | null;
  selectedClientId: string | null;
  request: RequestFn;
  exports: ClientExport[];
  refreshExports: () => Promise<void>;
  catalogItemSuggestions: ClientCatalogItemSuggestion[];
  setCatalogItemSuggestions: React.Dispatch<
    React.SetStateAction<ClientCatalogItemSuggestion[]>
  >;
  setSuggestionQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveItemSuggestionRowId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
};

export function useClientSalesActions({
  token,
  selectedClientId,
  request,
  exports,
  refreshExports,
  catalogItemSuggestions,
  setCatalogItemSuggestions,
  setSuggestionQuery,
  setActiveItemSuggestionRowId,
}: UseClientSalesActionsParams) {
  const [saleImages, setSaleImages] = useState<File[]>([]);
  const [salesFilterDate, setSalesFilterDate] = useState<Date | undefined>(
    () => new Date(),
  );
  const [saleImagesError, setSaleImagesError] = useState<string | null>(null);
  const [isExportingClientSales, setIsExportingClientSales] = useState(false);
  const [isLoadingClientSalesPreview, setIsLoadingClientSalesPreview] =
    useState(false);
  const [exportMonth, setExportMonth] = useState<number>(
    () => new Date().getMonth() + 1,
  );
  const [exportYear, setExportYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [saleTransactionPeriod, setSaleTransactionPeriod] = useState<
    "AM" | "PM" | null
  >(null);
  const [saleDiscountType, setSaleDiscountType] = useState<"fixed" | "percent">(
    "fixed",
  );
  const [saleDiscountValue, setSaleDiscountValue] = useState(0);
  const [saleNotes, setSaleNotes] = useState("");
  const [saleItems, setSaleItems] = useState<ClientSaleFormItem[]>([
    {
      id: crypto.randomUUID(),
      itemName: "",
      quantity: 1,
      unitPrice: 0,
    },
  ]);
  const [isSavingClientSale, setIsSavingClientSale] = useState(false);
  const [isClientSaleModalOpen, setIsClientSaleModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [clientSalesPreview, setClientSalesPreview] =
    useState<ClientSalesPreviewResponse | null>(null);
  const [dailySummarySalesInput, setDailySummarySalesInput] = useState("");
  const [isSavingDailySummarySales, setIsSavingDailySummarySales] =
    useState(false);

  const saleItemsSubtotal = useMemo(
    () =>
      saleItems.reduce(
        (sum, item) => sum + calculateSaleItemLineTotal(item),
        0,
      ),
    [saleItems],
  );
  const saleDiscountAmount = useMemo(() => {
    if (saleDiscountType === "percent") {
      return Math.max(0, saleItemsSubtotal * (saleDiscountValue / 100));
    }
    return Math.max(0, Math.min(saleDiscountValue, saleItemsSubtotal));
  }, [saleDiscountType, saleDiscountValue, saleItemsSubtotal]);
  const saleItemsGrandTotal = useMemo(
    () => Math.max(saleItemsSubtotal - saleDiscountAmount, 0),
    [saleItemsSubtotal, saleDiscountAmount],
  );
  const filteredExports = useMemo(() => {
    if (!salesFilterDate) {
      return exports;
    }

    const selectedDateKey = formatDateKey(salesFilterDate);
    return exports.filter(
      (entry) => normalizeDateKey(entry.sale_date) === selectedDateKey,
    );
  }, [exports, salesFilterDate]);
  const filteredItemSuggestions = useMemo(() => {
    const uniqueByName = new Map<string, ClientCatalogItemSuggestion>();
    for (const entry of catalogItemSuggestions) {
      if (!uniqueByName.has(entry.item_name)) {
        uniqueByName.set(entry.item_name, entry);
      }
    }
    return Array.from(uniqueByName.values()).slice(0, 8);
  }, [catalogItemSuggestions]);
  const selectedSalesDateKey = useMemo(
    () => (salesFilterDate ? formatDateKey(salesFilterDate) : null),
    [salesFilterDate],
  );
  useEffect(() => {
    if (!token || !selectedClientId || !selectedSalesDateKey) {
      setDailySummarySalesInput("");
      return;
    }

    const authToken = token;
    const clientId = selectedClientId;
    const salesDateKey = selectedSalesDateKey;
    let isCancelled = false;
    async function loadDailySummary() {
      try {
        const payload = await request<{
          total_summary_sales: number;
        } | null>(
          `/clients/${clientId}/daily-summary?sale_date=${salesDateKey}`,
          authToken,
        );
        if (isCancelled) {
          return;
        }
        setDailySummarySalesInput(
          payload ? payload.total_summary_sales.toFixed(2) : "",
        );
      } catch {
        if (!isCancelled) {
          setDailySummarySalesInput("");
        }
      }
    }
    void loadDailySummary();

    return () => {
      isCancelled = true;
    };
  }, [request, selectedClientId, selectedSalesDateKey, token]);

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

        await downloadFileWithToken({
          token,
          path: `/ocr-parent-submissions/${latest.parent_submission_id}/export-xlsx`,
          init: { method: "POST" },
          fileName: `sales_${latest.parent_submission_id}.xlsx`,
          errorMessage: "Unable to download processed sales file",
        });
        appToast.success({
          title: "Sales processed successfully",
          description: "Processed sales file downloaded.",
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

  function addSaleItem() {
    setSaleItems((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        itemName: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function updateSaleItem(
    itemId: string,
    field: "itemName" | "quantity" | "unitPrice",
    value: string,
  ) {
    setSaleItems((previous) =>
      previous.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (field === "itemName") {
          return { ...item, itemName: value };
        }
        const parsed = Number(value);
        return {
          ...item,
          [field]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
        };
      }),
    );
  }

  function removeSaleItem(itemId: string) {
    setSaleItems((previous) => {
      if (previous.length === 1) {
        return previous;
      }
      return previous.filter((item) => item.id !== itemId);
    });
  }

  function resetClientSaleForm() {
    setSaleDate("");
    setSaleTransactionPeriod(null);
    setSaleDiscountType("fixed");
    setSaleDiscountValue(0);
    setSaleNotes("");
    setSaleItems([
      {
        id: crypto.randomUUID(),
        itemName: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
    setActiveItemSuggestionRowId(null);
    setSuggestionQuery("");
    setCatalogItemSuggestions([]);
    setEditingSaleId(null);
  }

  function openEditClientSaleModal(entry: ClientExport) {
    setEditingSaleId(entry.id);
    setSaleDate(entry.sale_date);
    setSaleTransactionPeriod(entry.transaction_period);
    setSaleDiscountType(entry.discount_type);
    setSaleDiscountValue(entry.discount_value);
    setSaleNotes(entry.notes ?? "");
    setSaleItems(
      entry.items.length
        ? entry.items.map((item) => ({
            id: crypto.randomUUID(),
            itemName: item.item_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          }))
        : [
            {
              id: crypto.randomUUID(),
              itemName: "",
              quantity: 1,
              unitPrice: 0,
            },
          ],
    );
    setActiveItemSuggestionRowId(null);
    setSuggestionQuery("");
    setCatalogItemSuggestions([]);
    setIsClientSaleModalOpen(true);
  }

  async function handleSubmitClientSaleForm() {
    if (!token || !selectedClientId || isSavingClientSale) {
      return;
    }

    const hasInvalidItem = saleItems.some(
      (item) =>
        !item.itemName.trim() || item.quantity <= 0 || item.unitPrice < 0,
    );
    const hasInvalidDiscount =
      saleDiscountValue < 0 ||
      (saleDiscountType === "percent" && saleDiscountValue > 100);
    if (!saleDate) {
      appToast.error({
        title: "Sale date is required",
      });
      return;
    }
    if (hasInvalidItem || hasInvalidDiscount) {
      appToast.error({
        title: "Invalid sale items",
        description:
          "Each item needs name, quantity > 0, non-negative price, and valid overall discount.",
      });
      return;
    }

    setIsSavingClientSale(true);
    try {
      const path = editingSaleId
        ? `/clients/${selectedClientId}/exports/${editingSaleId}`
        : `/clients/${selectedClientId}/exports`;
      await request<ClientExport>(path, token, {
        method: editingSaleId ? "PUT" : "POST",
        body: JSON.stringify({
          sale_date: saleDate,
          transaction_period: saleTransactionPeriod,
          items: saleItems.map((item) => ({
            item_name: item.itemName.trim(),
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
          discount_type: saleDiscountType,
          discount_value: saleDiscountValue,
          notes: saleNotes.trim() || null,
        }),
      });
      await refreshExports();
      setIsClientSaleModalOpen(false);
      resetClientSaleForm();
      appToast.success({
        title: editingSaleId ? "Client sale updated" : "Client sale added",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to add client sale";
      appToast.error({
        title: "Failed to add client sale",
        description: message,
      });
    } finally {
      setIsSavingClientSale(false);
    }
  }

  async function handleExportClientSalesByMonth(): Promise<boolean> {
    if (!token || !selectedClientId || isExportingClientSales) {
      return false;
    }

    setIsExportingClientSales(true);
    try {
      await downloadFileWithToken({
        token,
        path: `/clients/${selectedClientId}/exports/export-xlsx?year=${exportYear}&month=${exportMonth}`,
        init: { method: "POST" },
        fileName: `client_sales_${selectedClientId}_${exportYear}_${String(exportMonth).padStart(2, "0")}.xlsx`,
        errorMessage: "Unable to download monthly sales file",
      });

      appToast.success({
        title: "Client sales exported",
        description: `Downloaded ${exportYear}-${String(exportMonth).padStart(2, "0")} export file.`,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to export client sales";
      appToast.error({
        title: "Client sales export failed",
        description: message,
      });
      return false;
    } finally {
      setIsExportingClientSales(false);
    }
  }

  async function handlePreviewClientSalesByMonth(): Promise<ClientSalesPreviewResponse | null> {
    if (!token || !selectedClientId || isLoadingClientSalesPreview) {
      return null;
    }

    setIsLoadingClientSalesPreview(true);
    try {
      const payload = await request<ClientSalesPreviewResponse>(
        `/clients/${selectedClientId}/exports/preview?year=${exportYear}&month=${exportMonth}`,
        token,
      );
      setClientSalesPreview(payload);
      return payload;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to preview client sales export";
      appToast.error({
        title: "Client sales preview failed",
        description: message,
      });
      return null;
    } finally {
      setIsLoadingClientSalesPreview(false);
    }
  }

  async function handleSaveDailySummarySales(): Promise<boolean> {
    if (
      !token ||
      !selectedClientId ||
      !selectedSalesDateKey ||
      isSavingDailySummarySales
    ) {
      return false;
    }

    const parsed = Number(dailySummarySalesInput);
    if (Number.isNaN(parsed) || parsed < 0) {
      appToast.error({
        title: "Invalid daily summary",
        description: "Enter a valid non-negative number.",
      });
      return false;
    }

    setIsSavingDailySummarySales(true);
    try {
      await request(`/clients/${selectedClientId}/daily-summary`, token, {
        method: "PUT",
        body: JSON.stringify({
          sale_date: selectedSalesDateKey,
          total_summary_sales: parsed,
        }),
      });
      appToast.success({
        title: "Daily summary saved",
        description: `Saved for ${selectedSalesDateKey}.`,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save daily summary";
      appToast.error({
        title: "Save failed",
        description: message,
      });
      return false;
    } finally {
      setIsSavingDailySummarySales(false);
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

  return {
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
    setIsClientSaleModalOpen,
    setDailySummarySalesInput,
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
  };
}
