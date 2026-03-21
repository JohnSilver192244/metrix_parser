import type {
  TriggerUpdateRequestBody,
  TriggerUpdateResponse,
  UpdateOperation,
} from "@metrix-parser/shared-types";

import { requestJson } from "./http";

export function triggerUpdate(
  operation: UpdateOperation,
  body: TriggerUpdateRequestBody,
): Promise<TriggerUpdateResponse> {
  return requestJson<TriggerUpdateResponse>(`/updates/${operation}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
