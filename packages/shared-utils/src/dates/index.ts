export function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}
