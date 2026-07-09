# Implementation Plan: Обновление одного парка (Course) из списка парков

## Обзор
Добавить возможность обновления одного конкретного курса (парка) по кнопке "Обновить" в таблице на странице `/courses`. Доступно только авторизованным пользователям.

---

## Архитектура изменений

### 1. Worker Job — `apps/worker/src/jobs/courses-update-job.ts`

**Новая экспортируемая функция:** `runSingleCourseUpdateJob(courseId, dependencies)`

```typescript
export async function runSingleCourseUpdateJob(
  courseId: string,
  dependencies: CoursesUpdateJobDependencies
): Promise<UpdateOperationResult> {
  // 1. client.fetchCourse({ courseId })
  // 2. mapDiscGolfMetrixCourseRecord
  // 3. repository.saveCourses([{ course, rawPayload, sourceFetchedAt }], { overwriteExisting: true })
  // 4. return UpdateOperationResult
}
```

**Использует существующие:**
- `createDiscGolfMetrixClient` + `fetchCourse` (уже есть в client.ts)
- `mapDiscGolfMetrixCourseRecord` (в mapping/courses.ts)
- `createCoursesRepository` + `createSupabaseCoursesAdapter`
- `UPDATE_IDENTITY_RULES.course` (matchFields: ["course_id"])

---

### 2. Worker Orchestration — `apps/worker/src/orchestration/courses-single-update.ts` (новый файл)

```typescript
import type { WorkerEnv } from "../config/env";
import { runSingleCourseUpdateJob } from "../jobs/courses-update-job";

export async function executeSingleCourseUpdate(
  courseId: string,
  env: Pick<WorkerEnv, "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode">
): Promise<UpdateOperationResult> {
  return runSingleCourseUpdateJob(courseId, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
  });
}
```

---

### 3. API-side Bridge — `apps/api/src/modules/courses/execution.ts` (новый файл)

**Критическое изменение:** Bridge НЕ использует `result.course` (его нет в `UpdateOperationResult`). Вместо этого:
1. Вызывает worker orchestration
2. Через репозиторий сохраняет курс (`saveCourse` с `overwriteExisting: true`)
3. Читает свежую запись через адаптер (`findByCourseId`)
4. Возвращает `Course`

```typescript
import { loadWorkerExecutionEnv } from "../../../../worker/src/config/env";
import { executeSingleCourseUpdate } from "../../../../worker/src/orchestration/courses-single-update";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";
import { createSupabaseCoursesAdapter } from "../../../../worker/src/persistence/supabase-courses-adapter";
import { createCoursesRepository } from "../../../../worker/src/persistence/courses-repository";

export async function executeRuntimeSingleCourseUpdate(
  courseId: string
): Promise<Course> {
  // 1. Запускаем worker job для fetch + map + save
  await executeSingleCourseUpdate(courseId, loadWorkerExecutionEnv());

  // 2. Читаем свежую запись из БД через adapter
  const supabase = createApiSupabaseAdminClient();
  const adapter = createSupabaseCoursesAdapter(supabase);
  const repository = createCoursesRepository(adapter);
  
  // Используем внутренний метод репозитория для чтения
  const existing = await adapter.findByCourseId(courseId);
  if (!existing) {
    throw new Error(`Course ${courseId} not found after update`);
  }

  // 3. Маппим в Course
  return toCourse(existing);
}

// Вспомогательная функция (скопировать из index.ts или вынести в shared)
function toCourse(record: CourseDbRecord): Course {
  return {
    courseId: record.course_id,
    name: record.name,
    fullname: record.fullname,
    type: record.type,
    countryCode: record.country_code,
    area: record.area,
    ratingValue1: record.rating_value1,
    ratingResult1: record.rating_result1,
    ratingValue2: record.rating_value2,
    ratingResult2: record.rating_result2,
    coursePar: record.course_par,
    basketsCount: record.baskets_count,
  };
}
```

---

### 4. API Routes — `apps/api/src/modules/courses/index.ts`

**Изменения в `CoursesRouteDependencies`:**
```typescript
export interface CoursesRouteDependencies {
  listCourses?: () => Promise<Course[]>;
  updateCourse?: (courseId: string) => Promise<Course>;  // НОВОЕ
}
```

**Изменения в `getCoursesRoutes`:**
```typescript
export function getCoursesRoutes(
  dependencies: CoursesRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},  // НОВЫЙ параметр
): RouteDefinition[] {
```

**Новый endpoint:**
```typescript
{
  method: "POST",
  path: "/courses/:courseId/update",
  handler: async ({ req, res, params }) => {
    const user = await requireAuthenticatedUser(readSessionToken(req), authDependencies);
    const courseId = params.courseId?.trim();
    if (!courseId) throw new HttpError(400, "invalid_course_id", "courseId is required");

    const updateCourse = dependencies.updateCourse ?? executeRuntimeSingleCourseUpdate;
    const course = await updateCourse(courseId);

    // /courses НЕ кэшируется в api-read-cache (CACHED_GET_ROUTE_PATHS не включает его).
    // Вызов безопасен, но не обязателен для данного эндпоинта.
    invalidateApiReadCacheAll();
    sendSuccess(res, course);  // возвращаем Course напрямую
  }
}
```

**Новые импорты в index.ts:**
- `HttpError` из `../../lib/http-errors`
- `readSessionToken`, `requireAuthenticatedUser`, `AuthGuardDependencies` из `../auth/runtime`
- `invalidateApiReadCacheAll` из `../../lib/api-read-cache`
- `executeRuntimeSingleCourseUpdate` из `./execution`

---

### 5. Frontend API — `apps/web/src/shared/api/courses.ts`

```typescript
export function updateCourse(courseId: string): Promise<Course> {
  return requestJson<Course>(`/courses/${encodeURIComponent(courseId)}/update`, {
    method: "POST",
  });
}
```

---

### 6. Frontend UI — `apps/web/src/features/courses/courses-page.tsx`

**Архитектура: логика в `CoursesPage`, презентация в `CoursesPageView`**

#### CoursesPage (container):
```typescript
export function CoursesPage() {
  const auth = useAuth();
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [updatingCourseId, setUpdatingCourseId] = useState<string | null>(null);  // локальный loading state

  async function handleUpdateCourse(courseId: string) {
    setUpdatingCourseId(courseId);
    try {
      await updateCourse(courseId);
      setToast({ message: "Парк успешно обновлён", tone: "success" });
    } catch (error) {
      setToast({ message: `Ошибка обновления: ${error.message}`, tone: "error" });
    } finally {
      setUpdatingCourseId(null);
    }
  }

  return <CoursesPageView 
    state={state}  // уже есть
    authStatus={auth.status} 
    onUpdateCourse={handleUpdateCourse}
    updatingCourseId={updatingCourseId}  // передаём для disabled
    toast={toast}
    onToastClose={() => setToast(null)}
  />;
}
```

#### CoursesPageView (presentational) — расширить `CoursesPageViewProps` (все новые пропсы **опциональны** для совместимости с тестами):
```typescript
export interface CoursesPageViewProps {
  state: CoursesPageState;
  mobileFiltersOpen?: boolean;
  authStatus?: "loading" | "authenticated" | "anonymous";   // optional, default "anonymous"
  onUpdateCourse?: (courseId: string) => void;               // optional
  updatingCourseId?: string | null;                          // optional
  toast?: { message: string; tone: "success" | "error" } | null;  // optional
  onToastClose?: () => void;                                 // optional
}
```

**Внутри CoursesPageView — дефолты для пропсов:**
```typescript
function CoursesPageView({
  state,
  mobileFiltersOpen = false,
  authStatus = "anonymous",
  onUpdateCourse,
  updatingCourseId = null,
  toast = null,
  onToastClose,
}: CoursesPageViewProps) {
  // ...
}
```

**В таблице:**
- Добавить `<th scope="col">Действия</th>` в заголовок
- В каждой строке `<td>`:
  ```tsx
  {authStatus === "authenticated" && onUpdateCourse && (
    <button
      className="courses-page__update-button"
      onClick={() => onUpdateCourse(course.courseId)}
      disabled={updatingCourseId === course.courseId}
      aria-label={`Обновить парк ${resolveCourseName(course)}`}
    >
      <RefreshIcon />  // или svg refresh
    </button>
  )}
  ```

**Toast рендер** внизу `CoursesPageView`:
```tsx
<ActionToast message={toast?.message ?? null} tone={toast?.tone ?? "success"} onClose={onToastClose} />
```

---

## Тестирование

1. **Unit тесты:**
   - `runSingleCourseUpdateJob` — успех, ошибка сети, невалидный payload
   - `executeRuntimeSingleCourseUpdate` — мокает worker env + adapter.findByCourseId
   - API handler — 401 без auth, 400 без courseId, 200 успех

2. **Интеграционные тесты:**
   - Полный цикл: POST /courses/:courseId/update → fetch → save → read → response

3. **UI тесты (Playwright + существующие unit):**
   - Существующие тесты `courses-page.test.tsx` продолжают работать (пропсы опциональны)
   - Новые тесты: кнопка видна авторизованному / скрыта гостю / тост после успеха/ошибки

---

## Порядок выполнения

1. **Worker job** — `runSingleCourseUpdateJob` в `courses-update-job.ts`
2. **Worker orchestration** — `executeSingleCourseUpdate` в `courses-single-update.ts`
3. **API bridge** — `executeRuntimeSingleCourseUpdate` в `api/modules/courses/execution.ts` (save + findByCourseId)
4. **API route** — новый endpoint в `courses/index.ts` с auth guard
5. **Frontend API** — `updateCourse` в `courses.ts`
6. **Frontend UI** — логика в `CoursesPage` + кнопка + toast в `CoursesPageView` (пропсы опциональны)
7. **Тесты** — unit + интеграционные + UI

---

## Примечания

- **Идемпотентность:** Курс обновляется по `course_id` (matchFields: ["course_id"] в UPDATE_IDENTITY_RULES)
- **Перезапись:** `overwriteExisting: true` для принудительного обновления
- **Кеш:** `/courses` не кэшируется в `api-read-cache` (CACHED_GET_ROUTE_PATHS не включает этот путь). `invalidateApiReadCacheAll()` вызывается для консистентности, но не критично для данного эндпоинта.
- **Bridge pattern:** `executeRuntimeSingleCourseUpdate` делает `workerJob → repository.saveCourse → adapter.findByCourseId → toCourse` и возвращает `Course`.
- **Обработка ошибок:** Пробрасывать ошибки DiscGolfMetrix как понятные сообщения в UI
- **Response:** API возвращает `Course` напрямую (не `UpdateOperationResult`), frontend ожидает `Course`
- **Endpoint path:** `POST /courses/:courseId/update` (можно `refresh` вместо `update` — не критично)
- **Тесты совместимости:** Все новые пропсы в `CoursesPageViewProps` опциональны с дефолтами — существующие тесты не сломаются.

---

## Файловая карта изменений

| Файл | Тип изменения |
|------|--------------|
| `apps/worker/src/jobs/courses-update-job.ts` | Добавить `runSingleCourseUpdateJob` |
| `apps/worker/src/orchestration/courses-single-update.ts` | **Новый файл** |
| `apps/api/src/modules/courses/execution.ts` | **Новый файл** — bridge: workerJob + save + findByCourseId |
| `apps/api/src/modules/courses/index.ts` | Расширить deps, добавить authDependencies, endpoint |
| `apps/web/src/shared/api/courses.ts` | Добавить `updateCourse` |
| `apps/web/src/features/courses/courses-page.tsx` | Разделить логику/презентацию, опциональные пропсы, кнопка + toast |