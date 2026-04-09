import { createClient } from "@supabase/supabase-js";

const DEFAULT_COMPETITION_ID = "3234152";

type TableName =
  | "season_standings"
  | "competition_results"
  | "competitions";

interface CliOptions {
  competitionId: string;
  execute: boolean;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  tsx ./scripts/delete-competition.ts [--id=<competitionId>] [--execute]",
      "",
      "Options:",
      `  --id=<competitionId>  Competition ID to remove (default: ${DEFAULT_COMPETITION_ID})`,
      "  --execute             Apply deletion. Without this flag script runs in dry-run mode.",
    ].join("\n"),
  );
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseArgs(argv: string[]): CliOptions {
  let competitionId = DEFAULT_COMPETITION_ID;
  let execute = false;

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (!current) {
      continue;
    }

    if (current === "--help" || current === "-h") {
      printUsage();
      process.exit(0);
    }

    if (current === "--execute") {
      execute = true;
      continue;
    }

    if (current.startsWith("--id=")) {
      const id = current.slice("--id=".length).trim();
      if (!id) {
        throw new Error("Flag --id requires a non-empty value.");
      }

      competitionId = id;
      continue;
    }

    if (current === "--id") {
      const id = argv[i + 1]?.trim();
      if (!id) {
        throw new Error("Flag --id requires a value.");
      }

      competitionId = id;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return { competitionId, execute };
}

function createSupabaseAdminClient() {
  const supabaseUrl = readRequiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function countRowsByCompetitionId(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: TableName,
  competitionId: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("competition_id", { head: true, count: "exact" })
    .eq("competition_id", competitionId);

  if (error) {
    throw new Error(`Failed to count rows in app_public.${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function deleteRowsByCompetitionId(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: TableName,
  competitionId: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .delete({ count: "exact" })
    .eq("competition_id", competitionId);

  if (error) {
    throw new Error(`Failed to delete rows from app_public.${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();

  const existingCompetitionCount = await countRowsByCompetitionId(
    supabase,
    "competitions",
    options.competitionId,
  );
  const existingResultsCount = await countRowsByCompetitionId(
    supabase,
    "competition_results",
    options.competitionId,
  );
  const existingSeasonStandingsCount = await countRowsByCompetitionId(
    supabase,
    "season_standings",
    options.competitionId,
  );

  console.log(`Competition ID: ${options.competitionId}`);
  console.log(
    `Found rows -> competitions: ${existingCompetitionCount}, competition_results: ${existingResultsCount}, season_standings: ${existingSeasonStandingsCount}`,
  );

  if (!options.execute) {
    console.log("Dry-run mode. Add --execute to apply deletion.");
    return;
  }

  const deletedSeasonStandingsCount = await deleteRowsByCompetitionId(
    supabase,
    "season_standings",
    options.competitionId,
  );
  const deletedResultsCount = await deleteRowsByCompetitionId(
    supabase,
    "competition_results",
    options.competitionId,
  );
  const deletedCompetitionCount = await deleteRowsByCompetitionId(
    supabase,
    "competitions",
    options.competitionId,
  );

  console.log(
    `Deleted rows -> season_standings: ${deletedSeasonStandingsCount}, competition_results: ${deletedResultsCount}, competitions: ${deletedCompetitionCount}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Deletion script failed: ${message}`);
  process.exitCode = 1;
});
