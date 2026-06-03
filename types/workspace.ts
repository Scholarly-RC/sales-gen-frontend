export type WorkspaceSection =
  | "dashboard"
  | "clients"
  | "client-sales"
  | "client-expenses"
  | "catalog"
  | "users";

export const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  "dashboard",
  "clients",
  "client-sales",
  "client-expenses",
  "catalog",
  "users",
];

export type ClientExpenseType =
  | "food_ingredients"
  | "drink_ingredients"
  | "water_expense"
  | "savings"
  | "kitchen_fuel_expense"
  | "salaries_expense"
  | "kitchen_supplies_expense"
  | "office_supplies_expense"
  | "cleaning_supplies_expense"
  | "purchase_resale_items"
  | "drawings"
  | "snacks_and_meals_expense"
  | "packaging_supplies_expense"
  | "repairs_maintenance"
  | "fuel_expense";

export type ClientVatStatus = "vat" | "non_vat";

export type ClientExpense = {
  id: string;
  client_id: string;
  user_id: string;
  transaction_date: string;
  expense_type: ClientExpenseType;
  amount: number;
  vat_status: ClientVatStatus;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  can_delete?: boolean;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  company: string | null;
  notes: string | null;
  sales_template_storage_key: string | null;
  sales_template_file_name: string | null;
  expenses_template_storage_key: string | null;
  expenses_template_file_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientExport = {
  id: string;
  client_id: string;
  user_id: string;
  sale_date: string;
  transaction_period: "AM" | "PM" | null;
  items: Array<{
    id: string;
    sale_record_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  discount_type: "fixed" | "percent";
  discount_value: number;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientCatalogItemSuggestion = {
  id: string;
  client_id: string;
  category_id: string | null;
  category_name: string | null;
  category: string | null;
  item_name: string;
  unit_price: number | null;
  created_at: string;
  updated_at: string;
};

export type ClientCatalogItemsPageResponse = {
  items: ClientCatalogItemSuggestion[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ClientCatalogCategory = {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ClientCatalogCategoriesPageResponse = {
  items: ClientCatalogCategory[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type OcrJobStatus = "queued" | "running" | "failed" | "done" | "stopped";

export type OcrJob = {
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

export type OcrParentSubmissionResponse = {
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

export type ClientExpensesPreviewResponse = {
  client_id: string;
  year: number;
  month: number;
  generated_at: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  totals_row: number[];
};

export type ClientSalesPreviewSheet = {
  name: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  row_count: number;
};

export type ClientDailySalesSummary = {
  id: string;
  client_id: string;
  sale_date: string;
  total_summary_sales: number;
  created_at: string;
  updated_at: string;
};

export type ClientSalesPreviewResponse = {
  client_id: string;
  year: number;
  month: number;
  generated_at: string;
  sheets: ClientSalesPreviewSheet[];
  daily_summaries: ClientDailySalesSummary[];
  is_truncated: boolean;
  max_rows_per_sheet: number;
};

export type ClientSaleFormItem = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};
