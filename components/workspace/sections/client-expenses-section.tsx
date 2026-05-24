import { format } from "date-fns";
import {
  CalendarDays,
  FileOutput,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { cn } from "@/lib/utils";
import type { ClientExpense } from "@/types/workspace";

type ClientExpensesSectionProps = {
  isSalesFilterPopoverOpen: boolean;
  setIsSalesFilterPopoverOpen: (open: boolean) => void;
  expenseFilterDate: Date | undefined;
  setExpenseFilterDate: (date: Date | undefined) => void;
  expenseDatesWithData: Date[];
  setIsClientExpensesExportModalOpen: (open: boolean) => void;
  selectedClientId: string | null;
  handleOpenCreateExpenseModal: () => void;
  isLoadingExpenses: boolean;
  filteredExpenses: ClientExpense[];
  expenseTypeLabels: Record<string, string>;
  openEditExpenseModal: (expense: ClientExpense) => void;
  setExpensePendingDelete: (expense: ClientExpense) => void;
  setIsDeleteExpenseModalOpen: (open: boolean) => void;
};

export function ClientExpensesSection({
  isSalesFilterPopoverOpen,
  setIsSalesFilterPopoverOpen,
  expenseFilterDate,
  setExpenseFilterDate,
  expenseDatesWithData,
  setIsClientExpensesExportModalOpen,
  selectedClientId,
  handleOpenCreateExpenseModal,
  isLoadingExpenses,
  filteredExpenses,
  expenseTypeLabels,
  openEditExpenseModal,
  setExpensePendingDelete,
  setIsDeleteExpenseModalOpen,
}: ClientExpensesSectionProps) {
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
                  !expenseFilterDate && "text-muted-foreground",
                )}
              >
                <CalendarDays className="size-4" />
                {expenseFilterDate ? (
                  format(expenseFilterDate, "PPP")
                ) : (
                  <span>Filter by day</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={expenseFilterDate}
                modifiers={{
                  hasData: expenseDatesWithData,
                }}
                onSelect={(date) => {
                  setExpenseFilterDate(date);
                  if (date) {
                    setIsSalesFilterPopoverOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          {expenseFilterDate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpenseFilterDate(undefined)}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsClientExpensesExportModalOpen(true)}
            disabled={!selectedClientId}
          >
            <FileOutput className="size-4" />
            Export
          </Button>
          <Button
            type="button"
            onClick={handleOpenCreateExpenseModal}
            disabled={!selectedClientId}
          >
            <PlusCircle className="size-4" />
            Add Expense
          </Button>
        </div>
      </div>
      <Separator />
      <div className="overflow-hidden rounded-xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction Date</TableHead>
              <TableHead>Expense Type</TableHead>
              <TableHead>VAT Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[220px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingExpenses ? (
              <TableRow>
                <TableCell colSpan={5}>Loading...</TableCell>
              </TableRow>
            ) : filteredExpenses.length ? (
              filteredExpenses.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.transaction_date}</TableCell>
                  <TableCell>{expenseTypeLabels[entry.expense_type]}</TableCell>
                  <TableCell>
                    {entry.vat_status === "vat" ? "VAT" : "Non-VAT"}
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditExpenseModal(entry)}
                      >
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setExpensePendingDelete(entry);
                          setIsDeleteExpenseModalOpen(true);
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
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  {expenseFilterDate
                    ? "No expenses found for the selected day."
                    : "No expenses found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
