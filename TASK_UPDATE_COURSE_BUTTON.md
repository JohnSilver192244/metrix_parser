# Задача: Добавление кнопки "Обновить парк" в просмотр соревнования

## Описание
Добавить кнопку "Обновить парк" на страницу просмотра результатов соревнования (`CompetitionResultsPage`), которая:
1. Выполняет разовый запрос к API DiscGolfMetrix с идентификатором парка (courseId)
2. Доступна только авторизованным пользователям
3. Показывает уведомление об успехе/ошибке через toast

## Реализованные изменения

### 1. `apps/web/src/features/results/competition-results-page.tsx`
- Добавлены импорты:
  - `updateCourse`, `resolveUpdateCourseErrorMessage` из `../../shared/api/courses`
  - `ActionToast` из `../../shared/action-toast`
  - `useAuth` из `../auth/auth-context`
- Расширен `CompetitionResultsPageViewProps`:
  - `authStatus?: "loading" | "authenticated" | "anonymous"`
  - `onUpdateCourse?: (courseId: string) => void`
  - `isUpdatingCourse?: boolean`
  - `toast?: { message: string; tone: "success" | "error" } | null`
  - `onToastClose?: () => void`
- В `CompetitionResultsPageView` добавлена кнопка в мета-информацию соревнования (ряд с названием парка), отображаемая только для авторизованных пользователей при наличии `courseId`
- Добавлен компонент `ActionToast` в конец рендера для уведомлений
- В `CompetitionResultsPage` добавлено:
  - Хук `useAuth()` для получения статуса авторизации
  - Состояния `toast`, `setToast`, `isUpdatingCourse`, `setIsUpdatingCourse`
  - Функция `handleUpdateCourse(courseId)` с обработкой ошибок и успеха
  - Передача новых пропсов в `CompetitionResultsPageView`

### 2. `apps/web/src/styles/global.css`
Добавлены стили для кнопки:
- `.competition-results-page__update-course-button` — базовый стиль (как link-button)
- Hover состояние для активной кнопки
- Disabled состояние

## Текущий статус
✅ **Завершено** — все изменения внесены, кнопка добавлена в UI, логика обновления подключена к существующему API endpoint `POST /courses/:courseId/update`

## API Endpoint
Используется существующий эндпоинт:
- `POST /courses/:courseId/update` — требует авторизацию (401 для гостей)
- Вызывает worker job `runSingleCourseUpdateJob` для разового обновления с DiscGolfMetrix
- Инвалидирует кэш после обновления

## Проверки
- Кнопка не отображается для гостей (`authStatus !== "authenticated"`)
- Кнопка не отображается если у соревнования нет `courseId`
- При клике отправляется запрос к API с `courseId` соревнования
- Показывается спиннер "..." во время загрузки
- Toast-уведомление об успехе или ошибке