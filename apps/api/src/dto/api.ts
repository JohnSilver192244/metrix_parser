import type {
  ApiEnvelope,
  ApiErrorDetails,
  ApiErrorEnvelope,
  ApiMeta,
} from "@metrix-parser/shared-types";

export type ApiSuccessResponse<TData, TMeta extends ApiMeta = ApiMeta> = ApiEnvelope<
  TData,
  TMeta
>;

export type ApiFailureResponse = ApiErrorEnvelope;

export type ApiErrorDto = ApiErrorDetails;

export interface HealthPayload {
  service: "api";
  status: "ok";
  timestamp: string;
}
