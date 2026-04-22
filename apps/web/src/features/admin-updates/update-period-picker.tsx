import React, { useEffect, useMemo, useRef, useState } from "react";

import type { UpdatePeriod } from "@metrix-parser/shared-types";

interface UpdatePeriodPickerProps {
  value: UpdatePeriod;
  onChange: (period: UpdatePeriod) => void;
  maxRangeDays?: number | null;
  presets?: PeriodPreset[];
  inputNames?: {
    dateFrom: string;
    dateTo: string;
  };
  label?: string;
  hideTriggerLabel?: boolean;
}

export interface PeriodPreset {
  id: string;
  label: string;
  resolve: (today: Date) => UpdatePeriod;
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const UTC_DAY_IN_MS = 24 * 60 * 60 * 1000;

function createUtcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function startOfUtcDay(date: Date): Date {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return startOfUtcDay(copy);
}

function addUtcMonths(date: Date, months: number): Date {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
}

function formatDateForApi(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string): string {
  return DATE_LABEL_FORMATTER.format(new Date(`${value}T00:00:00Z`));
}

export function formatMonthLabel(value: Date): string {
  return MONTH_LABEL_FORMATTER.format(value);
}

function parseApiDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function isPeriodValueEmpty(period: UpdatePeriod): boolean {
  return period.dateFrom.trim() === "" || period.dateTo.trim() === "";
}

function toNullableDate(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function getRangeDays(dateFrom: Date, dateTo: Date): number {
  const min = Math.min(dateFrom.getTime(), dateTo.getTime());
  const max = Math.max(dateFrom.getTime(), dateTo.getTime());

  return Math.floor((max - min) / UTC_DAY_IN_MS) + 1;
}

function resolveInitialViewDate(period: UpdatePeriod): Date {
  if (isPeriodValueEmpty(period)) {
    return getStartOfMonth(startOfUtcDay(new Date()));
  }

  return getStartOfMonth(parseApiDate(period.dateFrom));
}

function getStartOfWeek(date: Date): Date {
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;

  return addUtcDays(date, mondayOffset);
}

function getEndOfWeek(date: Date): Date {
  return addUtcDays(getStartOfWeek(date), 6);
}

function getStartOfMonth(date: Date): Date {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function getMonthDays(viewDate: Date): Array<Date | null> {
  const monthStart = getStartOfMonth(viewDate);
  const monthEnd = createUtcDate(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 0);
  const leadingEmptyDays = (monthStart.getUTCDay() + 6) % 7;
  const days: Array<Date | null> = [];

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= monthEnd.getUTCDate(); day += 1) {
    days.push(createUtcDate(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function resolveCurrentWeek(today: Date): UpdatePeriod {
  const safeToday = startOfUtcDay(today);

  return {
    dateFrom: formatDateForApi(getStartOfWeek(safeToday)),
    dateTo: formatDateForApi(safeToday),
  };
}

function resolvePreviousWeek(today: Date): UpdatePeriod {
  const safeToday = startOfUtcDay(today);
  const currentWeekStart = getStartOfWeek(safeToday);
  const previousWeekStart = addUtcDays(currentWeekStart, -7);

  return {
    dateFrom: formatDateForApi(previousWeekStart),
    dateTo: formatDateForApi(addUtcDays(previousWeekStart, 6)),
  };
}

function resolveCurrentMonth(today: Date): UpdatePeriod {
  const safeToday = startOfUtcDay(today);

  return {
    dateFrom: formatDateForApi(getStartOfMonth(safeToday)),
    dateTo: formatDateForApi(safeToday),
  };
}

function resolveRollingMonth(today: Date): UpdatePeriod {
  const safeToday = startOfUtcDay(today);

  return {
    dateFrom: formatDateForApi(addUtcDays(safeToday, -29)),
    dateTo: formatDateForApi(safeToday),
  };
}

const DEFAULT_PERIOD_PRESETS: PeriodPreset[] = [
  {
    id: "current-week",
    label: "Текущая неделя",
    resolve: resolveCurrentWeek,
  },
  {
    id: "previous-week",
    label: "Прошлая неделя",
    resolve: resolvePreviousWeek,
  },
  {
    id: "current-month",
    label: "Текущий месяц",
    resolve: resolveCurrentMonth,
  },
  {
    id: "rolling-month",
    label: "Скользящий месяц",
    resolve: resolveRollingMonth,
  },
];

function formatPeriodLabel(period: UpdatePeriod): string {
  if (isPeriodValueEmpty(period)) {
    return "Не выбран";
  }

  return `${formatDateLabel(period.dateFrom)} - ${formatDateLabel(period.dateTo)}`;
}

export function createDefaultUpdatePeriod(today: Date = new Date()): UpdatePeriod {
  return resolveCurrentWeek(today);
}

export function clampUpdatePeriodToMaxRange(
  period: UpdatePeriod,
  maxRangeDays?: number | null,
): UpdatePeriod {
  if (
    maxRangeDays === undefined ||
    maxRangeDays === null ||
    maxRangeDays <= 0 ||
    isPeriodValueEmpty(period)
  ) {
    return period;
  }

  const start = parseApiDate(period.dateFrom);
  const end = parseApiDate(period.dateTo);
  const sortedStart = start.getTime() <= end.getTime() ? start : end;
  const sortedEnd = start.getTime() <= end.getTime() ? end : start;

  if (getRangeDays(sortedStart, sortedEnd) <= maxRangeDays) {
    return {
      dateFrom: formatDateForApi(sortedStart),
      dateTo: formatDateForApi(sortedEnd),
    };
  }

  return {
    dateFrom: formatDateForApi(addUtcDays(sortedEnd, -(maxRangeDays - 1))),
    dateTo: formatDateForApi(sortedEnd),
  };
}

export function isDateSelectionWithinMaxRange(
  startDate: string,
  endDate: string,
  maxRangeDays?: number | null,
): boolean {
  if (maxRangeDays === undefined || maxRangeDays === null || maxRangeDays <= 0) {
    return true;
  }

  return getRangeDays(parseApiDate(startDate), parseApiDate(endDate)) <= maxRangeDays;
}

export function UpdatePeriodPicker({
  value,
  onChange,
  maxRangeDays = null,
  presets = DEFAULT_PERIOD_PRESETS,
  inputNames = {
    dateFrom: "shared-date-from",
    dateTo: "shared-date-to",
  },
  label = "Период",
  hideTriggerLabel = false,
}: UpdatePeriodPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(toNullableDate(value.dateFrom));
  const [draftEnd, setDraftEnd] = useState<string | null>(toNullableDate(value.dateTo));
  const [selectionStep, setSelectionStep] = useState<"start" | "end">("start");
  const [viewDate, setViewDate] = useState<Date>(() => resolveInitialViewDate(value));

  const monthDays = useMemo(() => getMonthDays(viewDate), [viewDate]);
  const draftIsComplete = draftStart !== null && draftEnd !== null;
  const draftRangeDays =
    draftIsComplete && draftStart && draftEnd
      ? getRangeDays(parseApiDate(draftStart), parseApiDate(draftEnd))
      : null;
  const isDraftRangeAllowed =
    draftRangeDays === null || maxRangeDays === null || draftRangeDays <= maxRangeDays;

  useEffect(() => {
    if (!isOpen) {
      setDraftStart(toNullableDate(value.dateFrom));
      setDraftEnd(toNullableDate(value.dateTo));
      setSelectionStep("start");
      setViewDate(resolveInitialViewDate(value));
    }
  }, [isOpen, value.dateFrom, value.dateTo]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function openPicker() {
    setDraftStart(toNullableDate(value.dateFrom));
    setDraftEnd(toNullableDate(value.dateTo));
    setSelectionStep("start");
    setViewDate(resolveInitialViewDate(value));
    setIsOpen(true);
  }

  function applyPreset(preset: PeriodPreset) {
    const nextPeriod = clampUpdatePeriodToMaxRange(preset.resolve(new Date()), maxRangeDays);

    onChange(nextPeriod);
    setDraftStart(nextPeriod.dateFrom);
    setDraftEnd(nextPeriod.dateTo);
    setSelectionStep("start");
    setViewDate(getStartOfMonth(parseApiDate(nextPeriod.dateFrom)));
    setIsOpen(false);
  }

  function applyDraft() {
    if (!draftStart || !draftEnd || !isDraftRangeAllowed) {
      return;
    }

    onChange({
      dateFrom: draftStart,
      dateTo: draftEnd,
    });
    setIsOpen(false);
  }

  function handleDaySelect(date: Date) {
    const selected = formatDateForApi(date);

    if (selectionStep === "start" || !draftStart) {
      setDraftStart(selected);
      setDraftEnd(null);
      setSelectionStep("end");
      return;
    }

    if (selected < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(selected);
    } else {
      setDraftEnd(selected);
    }

    setSelectionStep("start");
  }

  function isDateSelected(date: Date): boolean {
    const candidate = formatDateForApi(date);

    if (draftStart && draftEnd) {
      return candidate >= draftStart && candidate <= draftEnd;
    }

    return candidate === draftStart;
  }

  function isRangeBoundary(date: Date): boolean {
    const candidate = formatDateForApi(date);

    return candidate === draftStart || candidate === draftEnd;
  }

  function isDayDisabled(date: Date): boolean {
    if (selectionStep !== "end" || !draftStart || maxRangeDays === null) {
      return false;
    }

    return !isDateSelectionWithinMaxRange(
      draftStart,
      formatDateForApi(date),
      maxRangeDays,
    );
  }

  return (
    <div className="period-picker" ref={rootRef}>
      <input type="hidden" name={inputNames.dateFrom} value={value.dateFrom} />
      <input type="hidden" name={inputNames.dateTo} value={value.dateTo} />

      <button
        type="button"
        className={`period-picker__trigger${hideTriggerLabel ? " period-picker__trigger--compact" : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            openPicker();
          }
        }}
      >
        {hideTriggerLabel ? null : (
          <span className="period-picker__trigger-label">{label}</span>
        )}
        <strong>{formatPeriodLabel(value)}</strong>
      </button>

      {isOpen ? (
        <div
          className="period-picker__popover"
          role="dialog"
          aria-modal="false"
          aria-label={`Выбор периода: ${label}`}
        >
          <div className="period-picker__body">
            <div className="period-picker__presets">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="period-picker__preset"
                  onClick={() => {
                    applyPreset(preset);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="period-picker__calendar">
              <div className="period-picker__calendar-header">
                <button
                  type="button"
                  className="period-picker__nav"
                  aria-label="Предыдущий месяц"
                  onClick={() => {
                    setViewDate((current) => addUtcMonths(current, -1));
                  }}
                >
                  ←
                </button>
                <strong>{formatMonthLabel(viewDate)}</strong>
                <button
                  type="button"
                  className="period-picker__nav"
                  aria-label="Следующий месяц"
                  onClick={() => {
                    setViewDate((current) => addUtcMonths(current, 1));
                  }}
                >
                  →
                </button>
              </div>

              <div className="period-picker__weekday-row">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="period-picker__days">
                {monthDays.map((day, index) => {
                  if (!day) {
                    return <span key={`empty-${index}`} className="period-picker__day period-picker__day--empty" />;
                  }

                  const inRange = isDateSelected(day);
                  const isBoundary = isRangeBoundary(day);
                  const isDisabled = isDayDisabled(day);

                  return (
                    <button
                      key={formatDateForApi(day)}
                      type="button"
                      className={`period-picker__day${inRange ? " period-picker__day--selected" : ""}${isBoundary ? " period-picker__day--boundary" : ""}${isDisabled ? " period-picker__day--disabled" : ""}`}
                      disabled={isDisabled}
                      aria-pressed={inRange}
                      aria-label={`${formatDateLabel(formatDateForApi(day))}${isDisabled ? " (недоступно)" : ""}`}
                      onClick={() => {
                        handleDaySelect(day);
                      }}
                    >
                      {day.getUTCDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="period-picker__footer">
            <p className="period-picker__hint">
              {draftIsComplete
                ? `Выбран период: ${formatPeriodLabel({
                    dateFrom: draftStart,
                    dateTo: draftEnd,
                  })}`
                : "Выберите дату начала и дату окончания."}
              {maxRangeDays !== null
                ? ` Максимальная длина диапазона: ${maxRangeDays} дней.`
                : ""}
            </p>
            <div className="period-picker__footer-actions">
              <button
                type="button"
                className="period-picker__secondary"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="period-picker__primary"
                disabled={!draftIsComplete || !isDraftRangeAllowed}
                onClick={applyDraft}
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
