export function monthRange(month: string) {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const from = new Date(year, m - 1, 1);
  const to = new Date(year, m, 0, 23, 59, 59);
  return { from, to };
}
