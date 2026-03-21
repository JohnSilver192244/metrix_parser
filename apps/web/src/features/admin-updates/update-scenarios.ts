import type { UpdateOperation } from "@metrix-parser/shared-types";

export interface UpdateScenarioDefinition {
  operation: UpdateOperation;
  title: string;
  description: string;
  requiresPeriod: boolean;
  helperText: string;
  submitLabel: string;
}

export const updateScenarios: UpdateScenarioDefinition[] = [
  {
    operation: "competitions",
    title: "Соревнования",
    description:
      "Запускает импорт соревнований DiscGolfMetrix за выбранный период и подготавливает основу для следующих шагов.",
    requiresPeriod: true,
    helperText: "Используйте период, за который нужно обновить список соревнований.",
    submitLabel: "Запустить обновление соревнований",
  },
  {
    operation: "courses",
    title: "Парки",
    description:
      "Обновляет данные парков на основе уже сохранённых соревнований, без обязательного периода запуска.",
    requiresPeriod: false,
    helperText: "Сценарий берёт источник данных из сохранённых соревнований.",
    submitLabel: "Запустить обновление парков",
  },
  {
    operation: "players",
    title: "Игроки",
    description:
      "Подготавливает обновление игроков по сохранённым соревнованиям за выбранный период.",
    requiresPeriod: true,
    helperText: "Период определяет, по каким соревнованиям выбирать игроков для обработки.",
    submitLabel: "Запустить обновление игроков",
  },
  {
    operation: "results",
    title: "Результаты",
    description:
      "Запускает импорт результатов по соревнованиям за выбранный период с тем же UX-паттерном периода.",
    requiresPeriod: true,
    helperText: "Используйте тот же период, что и для игроков, если нужен согласованный запуск.",
    submitLabel: "Запустить обновление результатов",
  },
];
