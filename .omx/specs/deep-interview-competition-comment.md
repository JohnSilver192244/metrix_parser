# Competition Comment Field Spec Draft

## Metadata
- Profile: standard
- Context type: brownfield
- Rounds completed: 4
- Final ambiguity: low enough for a spec draft, with the remaining decision boundary resolved
- Context snapshot: `.omx/context/deep-interview-missing-task-20260407T083314Z.md`

## Intent
Add a competition-level comment field that records why an already-saved competition could not proceed through later processing steps.

## Desired outcome
When a downstream step fails for an existing competition, store one concise user-facing reason in the competition comment field on the competition that is shown in the competitions table and competition detail view.

## In scope
- Add a `comment` field for competitions.
- Field length limit: 2000 characters.
- Store only the first blocking reason.
- Cover downstream failures for existing competition rows.
- If the blocker originates in a child round/pool entity, write the reason to the parent competition row that the user sees.
- Category must be treated as two distinct failure families:
  - manual category update failure from the authenticated category-edit route,
  - automated category resolution failure during downstream scoring / accrual.
- The final planning decision uses one canonical competition-comment reconciliation pass that recomputes from current downstream state and clears the comment on success.

## Out of scope
- Import-stage skips that prevent a competition from being inserted.
- Storing a chain of multiple reasons.
- Turning the field into a structured diagnostics log.

## Decision boundaries
- OMX may decide the exact persistence and UI wiring, but not the meaning of the field.
- The field must describe the first blocking downstream reason only.
- The field should remain user-facing Russian text unless the implementation explicitly requires otherwise.
- The field is attached to the list-visible/detail-visible competition, not to child round/pool rows.
- The canonical blocker order is: fetch results > save results > manual category update > automated category resolution > season points.

## Covered actions
1. Fetch results for the competition.
2. Save competition results.
3. Manual category update.
4. Automated category resolution.
5. Accrue season points.

## User-facing reason families
### Fetch results
- Не удалось получить результаты.
- Нет идентификатора для запроса результатов.
- Внешний источник вернул ошибку или некорректный payload.

### Save results
- В результате не хватает обязательных полей.
- Результат нельзя сохранить из-за конфликта существующей записи.
- Перезапись существующей записи выключена.

### Assign category
- Ручное обновление категории не удалось.
- Категория не определяется по соревнованию или родителю.
- Категория отсутствует в цепочке родителей.
- Ошибка при сохранении/обновлении категории.

### Accrue season points
- Соревнование не подходит для начисления очков.
- Не найдена категория или коэффициент.
- Недостаточно участников для сезона.
- Не найдена строка матрицы очков под рассчитанный `players_count` и placement.
- Для сезона уже есть записи, а перезапись выключена.

## Parent competition rule
- If a problem occurs in a child round, pool, or similar descendant entity and prevents a downstream action from completing, the comment must be written on the parent competition that appears in the competitions table and detail view.
- The child row is not the target of the comment.

## Acceptance criteria
- If a competition already exists and the first downstream blocker is encountered, the comment is written once with that first reason.
- If two blockers coexist, the higher-priority blocker in the canonical order wins.
- The comment never exceeds 2000 characters.
- The comment is not populated for competitions that never reached the database.
- The implementation does not concatenate multiple downstream reasons.
