export function getExpensePreviewStickyClass(
  columnIndex: number,
  totalColumns: number,
  zIndexClass: "z-10" | "z-20",
  alignRight = false,
) {
  const alignClass = alignRight ? " text-right" : "";

  if (columnIndex === totalColumns - 1) {
    return `sticky right-0 ${zIndexClass} w-[120px] min-w-[120px] bg-background${alignClass}`;
  }

  if (columnIndex === totalColumns - 2) {
    return `sticky right-[120px] ${zIndexClass} w-[120px] min-w-[120px] bg-background${alignClass}`;
  }

  return alignRight ? "text-right" : "";
}
