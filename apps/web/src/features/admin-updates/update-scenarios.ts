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
    title: "Игроки и Результаты",
    description:
      "Запускает общий разбор result payload'ов за период: обновляет игроков и попутно сохраняет результаты, а статистику показывает по обеим сущностям отдельно.",
    requiresPeriod: true,
    helperText: "Используйте этот сценарий, если входной запрос нужен один раз, а в статистике важен отдельный блок по players и results.",
    submitLabel: "Запустить обновление игроков и результатов",
  },
  {
    operation: "results",
    title: "Результаты",
    description:
      "Запускает тот же общий pipeline по result payload'ам: обновляет и результаты, и игроков, а статистику возвращает раздельно.",
    requiresPeriod: true,
    helperText: "Отдельный повторный запуск после сценария игроков обычно не нужен, если период тот же.",
    submitLabel: "Запустить обновление результатов и игроков",
  },
];
