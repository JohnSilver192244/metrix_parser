export interface ApiMeta {
  [key: string]: unknown;
}

export interface ApiEnvelope<TData, TMeta extends ApiMeta = ApiMeta> {
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetails;
}
