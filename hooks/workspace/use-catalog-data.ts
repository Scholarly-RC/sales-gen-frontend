"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { debounce } from "@/lib/utils";
import type {
  ClientCatalogCategoriesPageResponse,
  ClientCatalogCategory,
  ClientCatalogItemSuggestion,
  ClientCatalogItemsPageResponse,
  WorkspaceSection,
} from "@/types/workspace";

type RequestFn = <T>(
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<T>;

type UseCatalogDataParams = {
  token: string | null;
  section: WorkspaceSection;
  selectedClientId: string | null;
  isCatalogCategoriesModalOpen: boolean;
  activeItemSuggestionRowId: string | null;
  request: RequestFn;
};

export function useCatalogData({
  token,
  section,
  selectedClientId,
  isCatalogCategoriesModalOpen,
  activeItemSuggestionRowId,
  request,
}: UseCatalogDataParams) {
  const [catalogItems, setCatalogItems] = useState<
    ClientCatalogItemSuggestion[]
  >([]);
  const [catalogCategories, setCatalogCategories] = useState<
    ClientCatalogCategory[]
  >([]);
  const [catalogCategoriesPageRows, setCatalogCategoriesPageRows] = useState<
    ClientCatalogCategory[]
  >([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [catalogTotalItems, setCatalogTotalItems] = useState(0);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesTotalPages, setCategoriesTotalPages] = useState(1);
  const [categoriesTotalItems, setCategoriesTotalItems] = useState(0);
  const [isLoadingCategoriesPage, setIsLoadingCategoriesPage] = useState(false);
  const [catalogItemSuggestions, setCatalogItemSuggestions] = useState<
    ClientCatalogItemSuggestion[]
  >([]);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [isLoadingCatalogItems, setIsLoadingCatalogItems] = useState(false);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);

  const loadCatalogItems = useCallback(
    async (accessToken: string, query: string, page: number) => {
      if (!selectedClientId) {
        setCatalogItems([]);
        setCatalogLoadError("Please select a client.");
        return;
      }

      setIsLoadingCatalogItems(true);
      setCatalogLoadError(null);

      const params = new URLSearchParams();
      params.set("page_size", "10");
      params.set("page", String(page));
      if (query.trim()) {
        params.set("q", query.trim());
      }

      try {
        const response = await request<ClientCatalogItemsPageResponse>(
          `/clients/${selectedClientId}/catalog-items/page?${params.toString()}`,
          accessToken,
        );
        setCatalogItems(response.items);
        setCatalogPage(response.page);
        setCatalogTotalPages(response.total_pages);
        setCatalogTotalItems(response.total);
      } catch (error) {
        setCatalogItems([]);
        setCatalogTotalPages(1);
        setCatalogTotalItems(0);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load catalog items";
        setCatalogLoadError(message);
      } finally {
        setIsLoadingCatalogItems(false);
      }
    },
    [request, selectedClientId],
  );

  const loadCatalogCategories = useCallback(
    async (accessToken: string) => {
      if (!selectedClientId) {
        setCatalogCategories([]);
        return;
      }

      try {
        const rows = await request<ClientCatalogCategory[]>(
          `/clients/${selectedClientId}/catalog-categories`,
          accessToken,
        );
        setCatalogCategories(rows);
      } catch {
        setCatalogCategories([]);
      }
    },
    [request, selectedClientId],
  );

  const loadCatalogCategoriesPage = useCallback(
    async (accessToken: string, page: number) => {
      if (!selectedClientId) {
        setCatalogCategoriesPageRows([]);
        setCategoriesPage(1);
        setCategoriesTotalPages(1);
        setCategoriesTotalItems(0);
        return;
      }

      setIsLoadingCategoriesPage(true);
      const params = new URLSearchParams();
      params.set("page_size", "10");
      params.set("page", String(page));

      try {
        const response = await request<ClientCatalogCategoriesPageResponse>(
          `/clients/${selectedClientId}/catalog-categories/page?${params.toString()}`,
          accessToken,
        );
        setCatalogCategoriesPageRows(response.items);
        setCategoriesPage(response.page);
        setCategoriesTotalPages(response.total_pages);
        setCategoriesTotalItems(response.total);
      } catch {
        setCatalogCategoriesPageRows([]);
        setCategoriesPage(1);
        setCategoriesTotalPages(1);
        setCategoriesTotalItems(0);
      } finally {
        setIsLoadingCategoriesPage(false);
      }
    },
    [request, selectedClientId],
  );

  const debouncedLoadCatalogItems = useMemo(
    () =>
      debounce((accessToken: string, query: string, page: number) => {
        void loadCatalogItems(accessToken, query, page);
      }, 300),
    [loadCatalogItems],
  );

  useEffect(
    () => () => {
      debouncedLoadCatalogItems.cancel();
    },
    [debouncedLoadCatalogItems],
  );

  const loadCatalogItemSuggestions = useCallback(
    async (accessToken: string, query: string) => {
      if (!selectedClientId) {
        setCatalogItemSuggestions([]);
        return;
      }

      const params = new URLSearchParams();
      params.set("limit", "20");
      if (query.trim()) {
        params.set("q", query.trim());
      }

      try {
        const rows = await request<ClientCatalogItemSuggestion[]>(
          `/clients/${selectedClientId}/catalog-items?${params.toString()}`,
          accessToken,
        );
        setCatalogItemSuggestions(rows);
      } catch {
        setCatalogItemSuggestions([]);
      }
    },
    [request, selectedClientId],
  );

  const debouncedLoadCatalogItemSuggestions = useMemo(
    () =>
      debounce((accessToken: string, query: string) => {
        void loadCatalogItemSuggestions(accessToken, query);
      }, 250),
    [loadCatalogItemSuggestions],
  );

  useEffect(
    () => () => {
      debouncedLoadCatalogItemSuggestions.cancel();
    },
    [debouncedLoadCatalogItemSuggestions],
  );

  useEffect(() => {
    if (!token || section !== "catalog" || !selectedClientId) {
      return;
    }

    debouncedLoadCatalogItems(token, catalogSearch, catalogPage);
    void loadCatalogCategories(token);
  }, [
    token,
    section,
    selectedClientId,
    catalogSearch,
    catalogPage,
    debouncedLoadCatalogItems,
    loadCatalogCategories,
  ]);

  useEffect(() => {
    if (!token || !isCatalogCategoriesModalOpen || !selectedClientId) {
      return;
    }
    void loadCatalogCategoriesPage(token, categoriesPage);
  }, [
    token,
    isCatalogCategoriesModalOpen,
    selectedClientId,
    categoriesPage,
    loadCatalogCategoriesPage,
  ]);

  useEffect(() => {
    if (
      !token ||
      section !== "client-sales" ||
      !selectedClientId ||
      !activeItemSuggestionRowId
    ) {
      return;
    }

    debouncedLoadCatalogItemSuggestions(token, suggestionQuery);
  }, [
    token,
    section,
    selectedClientId,
    activeItemSuggestionRowId,
    suggestionQuery,
    debouncedLoadCatalogItemSuggestions,
  ]);

  return {
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
    setCatalogCategoriesPageRows,
    setCatalogSearch,
    setCatalogPage,
    setCatalogTotalPages,
    setCatalogTotalItems,
    setCategoriesPage,
    setCategoriesTotalPages,
    setCategoriesTotalItems,
    setCatalogItemSuggestions,
    setSuggestionQuery,
    setCatalogLoadError,
    loadCatalogItems,
    loadCatalogCategories,
    loadCatalogCategoriesPage,
  };
}
