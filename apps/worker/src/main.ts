import { UPDATE_IDENTITY_RULES } from "@metrix-parser/shared-types";

const workerBootstrapMessage = {
  service: "worker",
  status: "bootstrapped",
  note: "Import worker skeleton is ready for ingestion stories.",
  persistenceLayer: "supabase-postgres",
  orchestrationMode: "partially-tolerant-pipeline",
  idempotentEntities: Object.keys(UPDATE_IDENTITY_RULES),
};

console.log(JSON.stringify(workerBootstrapMessage));
