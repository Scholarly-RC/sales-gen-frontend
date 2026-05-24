import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_OPTIONS } from "@/lib/workspace/constants";

type MonthSelectProps = {
  id: string;
  value: number;
  onValueChange: (nextValue: number) => void;
};

export function MonthSelect({ id, value, onValueChange }: MonthSelectProps) {
  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => onValueChange(Number(nextValue))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Month" />
      </SelectTrigger>
      <SelectContent>
        {MONTH_OPTIONS.map((month) => (
          <SelectItem key={month.value} value={month.value}>
            {month.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
