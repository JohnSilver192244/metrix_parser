export function formatCount(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}
