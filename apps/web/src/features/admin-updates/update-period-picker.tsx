import React, { useEffect, useMemo, useRef, useState } from "react";

import type { UpdatePeriod } from "@metrix-parser/shared-types";

interface UpdatePeriodPickerProps {
  value: UpdatePeriod;
  onChange: (period: UpdatePeriod) => void;
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
});
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

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

function parseApiDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
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
  return `${formatDateLabel(period.dateFrom)} - ${formatDateLabel(period.dateTo)}`;
}

export function createDefaultUpdatePeriod(today: Date = new Date()): UpdatePeriod {
  return resolveCurrentWeek(today);
}

export function UpdatePeriodPicker({
  value,
  onChange,
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
  const [draftStart, setDraftStart] = useState<string | null>(value.dateFrom);
  const [draftEnd, setDraftEnd] = useState<string | null>(value.dateTo);
  const [selectionStep, setSelectionStep] = useState<"start" | "end">("start");
  const [viewDate, setViewDate] = useState<Date>(() => getStartOfMonth(parseApiDate(value.dateFrom)));

  const monthDays = useMemo(() => getMonthDays(viewDate), [viewDate]);
  const draftIsComplete = draftStart !== null && draftEnd !== null;

  useEffect(() => {
    if (!isOpen) {
      setDraftStart(value.dateFrom);
      setDraftEnd(value.dateTo);
      setSelectionStep("start");
      setViewDate(getStartOfMonth(parseApiDate(value.dateFrom)));
    }
  }, [isOpen, value]);

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

  function openPicker() {
    setDraftStart(value.dateFrom);
    setDraftEnd(value.dateTo);
    setSelectionStep("start");
    setViewDate(getStartOfMonth(parseApiDate(value.dateFrom)));
    setIsOpen(true);
  }

  function applyPreset(preset: PeriodPreset) {
    const nextPeriod = preset.resolve(new Date());

    onChange(nextPeriod);
    setDraftStart(nextPeriod.dateFrom);
    setDraftEnd(nextPeriod.dateTo);
    setSelectionStep("start");
    setViewDate(getStartOfMonth(parseApiDate(nextPeriod.dateFrom)));
    setIsOpen(false);
  }

  function applyDraft() {
    if (!draftStart || !draftEnd) {
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
        <div className="period-picker__popover" role="dialog" aria-label={`Выбор периода: ${label}`}>
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
              <strong>{MONTH_LABEL_FORMATTER.format(viewDate)}</strong>
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

                return (
                  <button
                    key={formatDateForApi(day)}
                    type="button"
                    className={`period-picker__day${inRange ? " period-picker__day--selected" : ""}${isBoundary ? " period-picker__day--boundary" : ""}`}
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

          <div className="period-picker__footer">
            <p className="period-picker__hint">
              {draftIsComplete
                ? `Выбран период: ${formatPeriodLabel({
                    dateFrom: draftStart,
                    dateTo: draftEnd,
                  })}`
                : "Выберите дату начала и дату окончания."}
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
                disabled={!draftIsComplete}
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
