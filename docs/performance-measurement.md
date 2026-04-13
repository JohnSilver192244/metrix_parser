# Performance Measurement Playbook (P0)

## Что уже измеряется

### API
- Endpoint-level тайминги: `totalMs`, `dbMs`, `serializeMs`.
- SQL-level метрики: длительность, количество строк (`rows`, best-effort), endpoint-контекст.
- Агрегация `p95` top-10:
  - `GET /health/performance`
  - сброс in-memory агрегатов: `POST /health/performance/reset`

### Web
- По маршрутам собираются:
  - `TTFB` API-вызовов
  - `API call duration`
  - `LCP`
- Доступ в браузере:
  - `window.__METRIX_WEB_PERF__.snapshot()`
  - `window.__METRIX_WEB_PERF__.reset()`

## Baseline и повторный замер

1. Поднять API.
2. Снять baseline:

```bash
npm run perf:capture -- --api http://127.0.0.1:3001 --sample-traffic --out .omx/perf/baseline.json
```

3. После оптимизаций снять второй снапшот:

```bash
npm run perf:capture -- --api http://127.0.0.1:3001 --sample-traffic --out .omx/perf/after.json
```

4. Сравнить p95:

```bash
npm run perf:compare -- --baseline .omx/perf/baseline.json --after .omx/perf/after.json
```

## Пример текущих файлов замера

- `.omx/perf/baseline.json`
- `.omx/perf/after-observability.json`
