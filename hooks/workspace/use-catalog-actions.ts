"use client";

import { useMemo, useState } from "react";

import { appToast } from "@/lib/toast";
import type {
  ClientCatalogCategory,
  ClientCatalogItemSuggestion,
} from "@/types/workspace";

type RequestFn = <T>(
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<T>;

type UseCatalogActionsParams = {
  token: string | null;
  selectedClientId: string | null;
  catalogItems: ClientCatalogItemSuggestion[];
  catalogCategories: ClientCatalogCategory[];
  catalogSearch: string;
  catalogPage: number;
  categoriesPage: number;
  isCatalogCategoriesModalOpen: boolean;
  setIsCatalogCategoriesModalOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  request: RequestFn;
  setCatalogPage: React.Dispatch<React.SetStateAction<number>>;
  loadCatalogItems: (
    accessToken: string,
    query: string,
    page: number,
  ) => Promise<void>;
  loadCatalogCategories: (accessToken: string) => Promise<void>;
  loadCatalogCategoriesPage: (
    accessToken: string,
    page: number,
  ) => Promise<void>;
};

export function useCatalogActions({
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
}: UseCatalogActionsParams) {
  const [selectedCatalogItem, setSelectedCatalogItem] =
    useState<ClientCatalogItemSuggestion | null>(null);
  const [isCatalogItemModalOpen, setIsCatalogItemModalOpen] = useState(false);
  const [isCategoryComboboxOpen, setIsCategoryComboboxOpen] = useState(false);
  const [isDeleteCatalogItemModalOpen, setIsDeleteCatalogItemModalOpen] =
    useState(false);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] =
    useState(false);
  const [catalogItemPendingDelete, setCatalogItemPendingDelete] =
    useState<ClientCatalogItemSuggestion | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] =
    useState<ClientCatalogCategory | null>(null);
  const [isSavingCatalogItem, setIsSavingCatalogItem] = useState(false);
  const [isDeletingCatalogItem, setIsDeletingCatalogItem] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [catalogItemFormError, setCatalogItemFormError] = useState<
    string | null
  >(null);
  const [catalogItemForm, setCatalogItemForm] = useState({
    categoryId: "",
    itemName: "",
    unitPrice: "",
  });
  const [categoryFormName, setCategoryFormName] = useState("");
  const [categoryFormError, setCategoryFormError] = useState<string | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] =
    useState<ClientCatalogCategory | null>(null);

  const selectedCatalogCategoryLabel = useMemo(() => {
    if (!catalogItemForm.categoryId) {
      return "No category";
    }
    return (
      catalogCategories.find((entry) => entry.id === catalogItemForm.categoryId)
        ?.name ?? "Select category (optional)"
    );
  }, [catalogCategories, catalogItemForm.categoryId]);

  function openCatalogItemCreateModal() {
    setSelectedCatalogItem(null);
    setCatalogItemFormError(null);
    setCatalogItemForm({
      categoryId: "",
      itemName: "",
      unitPrice: "",
    });
    setIsCatalogItemModalOpen(true);
  }

  function openCatalogItemEditModal(item: ClientCatalogItemSuggestion) {
    setSelectedCatalogItem(item);
    setCatalogItemFormError(null);
    setCatalogItemForm({
      categoryId: item.category_id ?? "",
      itemName: item.item_name,
      unitPrice:
        item.unit_price !== null && item.unit_price !== undefined
          ? String(item.unit_price)
          : "",
    });
    setIsCatalogItemModalOpen(true);
  }

  async function handleSaveCatalogItem() {
    if (!token || !selectedClientId) {
      return;
    }

    const itemName = catalogItemForm.itemName.trim();
    const categoryId = catalogItemForm.categoryId || null;
    const unitPriceRaw = catalogItemForm.unitPrice.trim();
    const unitPrice =
      unitPriceRaw.length > 0 ? Number(unitPriceRaw) : (null as number | null);

    if (!itemName) {
      setCatalogItemFormError("Item name is required.");
      return;
    }
    if (unitPrice !== null && (Number.isNaN(unitPrice) || unitPrice < 0)) {
      setCatalogItemFormError("Unit price must be 0 or higher.");
      return;
    }

    setIsSavingCatalogItem(true);
    setCatalogItemFormError(null);

    try {
      if (selectedCatalogItem) {
        await request<ClientCatalogItemSuggestion>(
          `/clients/${selectedClientId}/catalog-items/${selectedCatalogItem.id}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({
              category_id: categoryId,
              item_name: itemName,
              unit_price: unitPrice,
            }),
          },
        );
        appToast.success({
          title: "Catalog item updated",
        });
      } else {
        await request<ClientCatalogItemSuggestion>(
          `/clients/${selectedClientId}/catalog-items`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              category_id: categoryId,
              item_name: itemName,
              unit_price: unitPrice,
            }),
          },
        );
        appToast.success({
          title: "Catalog item created",
        });
      }

      setIsCatalogItemModalOpen(false);
      await loadCatalogItems(token, catalogSearch, catalogPage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save catalog item";
      setCatalogItemFormError(message);
    } finally {
      setIsSavingCatalogItem(false);
    }
  }

  async function handleCreateOrUpdateCategory() {
    if (!token || !selectedClientId) {
      return;
    }

    const name = categoryFormName.trim();
    if (!name) {
      setCategoryFormError("Category name is required.");
      return;
    }

    const normalizedName = name.toLowerCase();
    const duplicate = catalogCategories.find((entry) => {
      if (selectedCategory && entry.id === selectedCategory.id) {
        return false;
      }
      return entry.name.trim().toLowerCase() === normalizedName;
    });
    if (duplicate) {
      setCategoryFormError("Category already exists.");
      return;
    }

    setIsSavingCategory(true);
    setCategoryFormError(null);

    try {
      if (selectedCategory) {
        await request<ClientCatalogCategory>(
          `/clients/${selectedClientId}/catalog-categories/${selectedCategory.id}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({ name }),
          },
        );
        await loadCatalogCategories(token);
        await loadCatalogCategoriesPage(token, categoriesPage);
        appToast.success({ title: "Category updated" });
      } else {
        await request<ClientCatalogCategory>(
          `/clients/${selectedClientId}/catalog-categories`,
          token,
          {
            method: "POST",
            body: JSON.stringify({ name }),
          },
        );
        await loadCatalogCategories(token);
        await loadCatalogCategoriesPage(token, categoriesPage);
        appToast.success({ title: "Category created" });
      }
      setCategoryFormName("");
      setSelectedCategory(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create category";
      setCategoryFormError(message);
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!token || !selectedClientId || !categoryPendingDelete) {
      return;
    }

    setIsDeletingCategory(true);
    try {
      await request<void>(
        `/clients/${selectedClientId}/catalog-categories/${categoryPendingDelete.id}`,
        token,
        { method: "DELETE" },
      );
      await loadCatalogCategories(token);
      const nextPage =
        catalogCategories.length === 1 && categoriesPage > 1
          ? categoriesPage - 1
          : categoriesPage;
      await loadCatalogCategoriesPage(token, nextPage);
      setIsDeleteCategoryModalOpen(false);
      setCategoryPendingDelete(null);
      appToast.success({ title: "Category deleted" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete category";
      appToast.error({
        title: "Failed to delete category",
        description: message,
      });
    } finally {
      setIsDeletingCategory(false);
    }
  }

  function openDeleteCatalogItemModal(item: ClientCatalogItemSuggestion) {
    setCatalogItemPendingDelete(item);
    setIsDeleteCatalogItemModalOpen(true);
  }

  async function handleDeleteCatalogItem() {
    if (!token || !selectedClientId || !catalogItemPendingDelete) {
      return;
    }

    setIsDeletingCatalogItem(true);
    try {
      await request<void>(
        `/clients/${selectedClientId}/catalog-items/${catalogItemPendingDelete.id}`,
        token,
        { method: "DELETE" },
      );
      setIsDeleteCatalogItemModalOpen(false);
      setCatalogItemPendingDelete(null);
      if (catalogItems.length === 1 && catalogPage > 1) {
        setCatalogPage((previous) => Math.max(1, previous - 1));
      } else {
        await loadCatalogItems(token, catalogSearch, catalogPage);
      }
      appToast.success({
        title: "Catalog item deleted",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete catalog item";
      appToast.error({
        title: "Failed to delete catalog item",
        description: message,
      });
    } finally {
      setIsDeletingCatalogItem(false);
    }
  }

  return {
    selectedCatalogItem,
    isCatalogItemModalOpen,
    isCategoryComboboxOpen,
    isCatalogCategoriesModalOpen,
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
    setSelectedCatalogItem,
    setIsCatalogItemModalOpen,
    setIsCategoryComboboxOpen,
    setIsCatalogCategoriesModalOpen,
    setIsDeleteCatalogItemModalOpen,
    setIsDeleteCategoryModalOpen,
    setCatalogItemPendingDelete,
    setCategoryPendingDelete,
    setCatalogItemFormError,
    setCatalogItemForm,
    setCategoryFormName,
    setCategoryFormError,
    setSelectedCategory,
    openCatalogItemCreateModal,
    openCatalogItemEditModal,
    handleSaveCatalogItem,
    handleCreateOrUpdateCategory,
    handleDeleteCategory,
    openDeleteCatalogItemModal,
    handleDeleteCatalogItem,
  };
}
