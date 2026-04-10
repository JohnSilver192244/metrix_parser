# Test Spec: settings-unified-sequence

## Unit / View Tests
1. `AdminUpdatesPage` рендерит последовательные шаги и disabled-кнопки до выбора диапазона.
2. `UpdatePeriodPicker` рендерит состояние `Не выбран` для пустого диапазона.
3. `clampUpdatePeriodToMaxRange` ограничивает диапазон до 14 дней.

## Regression
1. `npm run --workspace @metrix-parser/web test`
2. `npm run --workspace @metrix-parser/web build`
