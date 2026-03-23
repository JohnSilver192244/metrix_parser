import type { DiscGolfMetrixSourceRecord } from "../integration/discgolfmetrix";

function readField(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): unknown {
  for (const fieldName of fieldNames) {
    if (fieldName in record) {
      return record[fieldName];
    }
  }

  return undefined;
}

export function readOptionalStringField(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): string | undefined {
  const value = readField(record, fieldNames);

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function readOptionalNumberField(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): number | undefined {
  const value = readField(record, fieldNames);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (normalized.length === 0) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function readOptionalDateField(
  record: DiscGolfMetrixSourceRecord,
  fieldNames: readonly string[],
): string | undefined {
  const value = readOptionalStringField(record, fieldNames);

  if (!value) {
    return undefined;
  }

  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return normalizeDateParts(year, month, day);
  }

  const europeanDateMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (europeanDateMatch) {
    const [, day, month, year] = europeanDateMatch;
    return normalizeDateParts(year, month, day);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeDateParts(
  year: string,
  month: string,
  day: string,
): string | undefined {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  const parsed = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));

  if (
    parsed.getUTCFullYear() !== numericYear ||
    parsed.getUTCMonth() !== numericMonth - 1 ||
    parsed.getUTCDate() !== numericDay
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}
