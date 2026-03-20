export interface ApiEnvelope<TData> {
  data: TData;
  meta?: Record<string, unknown>;
}
