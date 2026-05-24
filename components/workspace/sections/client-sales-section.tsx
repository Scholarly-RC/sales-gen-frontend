import { format } from "date-fns";
import {
  ArrowUpRight,
  CalendarDays,
  FileOutput,
  LoaderCircle,
  Pencil,
  PlusCircle,
  View,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/workspace/utils";
import type { Client, ClientExport } from "@/types/workspace";

type ClientSalesSectionProps = {
  isSalesFilterPopoverOpen: boolean;
  setIsSalesFilterPopoverOpen: (open: boolean) => void;
  salesFilterDate: Date | undefined;
  setSalesFilterDate: (date: Date | undefined) => void;
  salesDatesWithData: Date[];
  setActiveDate: (date: string) => void;
  selectedSalesClient: Client | null;
  setIsClientSalesExportModalOpen: (open: boolean) => void;
  setIsClientSaleOcrModalOpen: (open: boolean) => void;
  disableProcessOcrSale: boolean;
  handleOpenCreateSaleModal: () => void;
  dailySummarySalesInput: string;
  setDailySummarySalesInput: (value: string) => void;
  handleSaveDailySummarySales: () => Promise<boolean>;
  isSavingDailySummarySales: boolean;
  isLoadingExports: boolean;
  filteredExports: ClientExport[];
  setSelectedSalePreview: (entry: ClientExport) => void;
  openEditClientSaleModal: (entry: ClientExport) => void;
};

export function ClientSalesSection({
  isSalesFilterPopoverOpen,
  setIsSalesFilterPopoverOpen,
  salesFilterDate,
  setSalesFilterDate,
  salesDatesWithData,
  setActiveDate,
  selectedSalesClient,
  setIsClientSalesExportModalOpen,
  setIsClientSaleOcrModalOpen,
  disableProcessOcrSale,
  handleOpenCreateSaleModal,
  dailySummarySalesInput,
  setDailySummarySalesInput,
  handleSaveDailySummarySales,
  isSavingDailySummarySales,
  isLoadingExports,
  filteredExports,
  setSelectedSalePreview,
  openEditClientSaleModal,
}: ClientSalesSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Popover
            open={isSalesFilterPopoverOpen}
            onOpenChange={setIsSalesFilterPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !salesFilterDate && "text-muted-foreground",
                )}
              >
                <CalendarDays className="size-4" />
                {salesFilterDate ? (
                  format(salesFilterDate, "PPP")
                ) : (
                  <span>Filter by day</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={salesFilterDate}
                modifiers={{
                  hasData: salesDatesWithData,
                }}
                onSelect={(date) => {
                  setSalesFilterDate(date);
                  if (date) {
                    setActiveDate(format(date, "yyyy-MM-dd"));
                    setIsSalesFilterPopoverOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          {salesFilterDate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSalesFilterDate(undefined)}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsClientSalesExportModalOpen(true)}
            disabled={!selectedSalesClient}
          >
            <FileOutput className="size-4" />
            Export
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsClientSaleOcrModalOpen(true)}
                  disabled={!selectedSalesClient || disableProcessOcrSale}
                >
                  <ArrowUpRight className="size-4" />
                  Process OCR Sale
                </Button>
              </span>
            </TooltipTrigger>
            {disableProcessOcrSale ? (
              <TooltipContent side="top" sideOffset={6}>
                Coming soon
              </TooltipContent>
            ) : null}
          </Tooltip>
          <Button
            type="button"
            onClick={handleOpenCreateSaleModal}
            disabled={!selectedSalesClient}
          >
            <PlusCircle className="size-4" />
            Add Client Sale
          </Button>
        </div>
      </div>

      <Separator />

      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <Label htmlFor="client-sales-daily-summary">
              Daily Summary of Sales
            </Label>
            <p className="text-xs text-muted-foreground">
              {salesFilterDate
                ? `Set summary for ${format(salesFilterDate, "PPP")}`
                : "Select a day first to set the summary."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              id="client-sales-daily-summary"
              type="number"
              step="0.01"
              min={0}
              className="h-9 w-full sm:w-[220px]"
              value={dailySummarySalesInput}
              onChange={(event) =>
                setDailySummarySalesInput(event.target.value)
              }
              disabled={!selectedSalesClient || !salesFilterDate}
            />
            <Button
              type="button"
              onClick={() => void handleSaveDailySummarySales()}
              disabled={
                !selectedSalesClient ||
                !salesFilterDate ||
                isSavingDailySummarySales
              }
            >
              {isSavingDailySummarySales ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction Period</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total Sale</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[220px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingExports ? (
              <TableRow>
                <TableCell colSpan={5}>Loading...</TableCell>
              </TableRow>
            ) : filteredExports.length ? (
              filteredExports.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.transaction_period ?? "Not set"}</TableCell>
                  <TableCell>{entry.items.length}</TableCell>
                  <TableCell>{entry.total.toFixed(2)}</TableCell>
                  <TableCell>{formatDate(entry.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSalePreview(entry)}
                      >
                        <View className="size-4" />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openEditClientSaleModal(entry)}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  {salesFilterDate
                    ? "No client sales records for the selected day."
                    : "No client sales records."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
