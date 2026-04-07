import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const stateDir = join(root, ".omx", "state");
const logsDir = join(root, ".omx", "logs");
const tickMs = 1000;

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function activeStateFiles() {
  try {
    return readdirSync(stateDir)
      .filter((name) => name.endsWith("-state.json"))
      .sort();
  } catch {
    return [];
  }
}

function recentLines(file, maxLines = 12) {
  try {
    const lines = readFileSync(file, "utf8").trim().split(/\r?\n/);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function formatJson(value) {
  if (value == null) return "—";
  return JSON.stringify(value, null, 2);
}

function summarizeSkillActive(value) {
  if (!value) return null;
  return {
    active: value.active,
    skill: value.skill,
    keyword: value.keyword,
    phase: value.phase,
    activated_at: value.activated_at,
    updated_at: value.updated_at,
    source: value.source,
  };
}

function summarizeTeamState(value) {
  if (!value) return null;
  return {
    active: value.active,
    workers: value.workers?.length ?? value.worker_count ?? value.count ?? null,
    phase: value.phase,
    job_id: value.job_id,
    updated_at: value.updated_at,
  };
}

function summarizeSimpleState(value) {
  if (!value) return null;
  return {
    active: value.active ?? value.enabled ?? null,
    phase: value.phase ?? null,
    updated_at: value.updated_at ?? value.last_tick_at ?? null,
    last_error: value.last_error ?? null,
  };
}

function pickLatestLogFile(prefix) {
  try {
    const candidates = readdirSync(logsDir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".jsonl"))
      .map((name) => ({
        name,
        path: join(logsDir, name),
        mtime: statSync(join(logsDir, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return candidates[0]?.path ?? null;
  } catch {
    return null;
  }
}

function printSection(title, content) {
  console.log(`\n=== ${title} ===`);
  console.log(content);
}

function render() {
  const hud = safeReadJson(join(stateDir, "hud-state.json"));
  const session = safeReadJson(join(stateDir, "session.json"));
  const skillActive = safeReadJson(join(stateDir, "skill-active-state.json"));
  const team = safeReadJson(join(stateDir, "team-state.json"));
  const autopilot = safeReadJson(join(stateDir, "autopilot-state.json"));
  const ralph = safeReadJson(join(stateDir, "ralph-state.json"));
  const pipeline = safeReadJson(join(stateDir, "pipeline-state.json"));
  const ecomode = safeReadJson(join(stateDir, "ecomode-state.json"));
  const tmuxHook = safeReadJson(join(stateDir, "tmux-hook-state.json"));
  const notifyHook = safeReadJson(join(stateDir, "notify-hook-state.json"));
  const notifyFallback = safeReadJson(join(stateDir, "notify-fallback-state.json"));

  const turnLog = pickLatestLogFile("turns-");
  const omxLog = pickLatestLogFile("omx-");
  const tmuxLog = pickLatestLogFile("tmux-hook-");

  console.clear();
  console.log("OMX DEV DASHBOARD");
  console.log(new Date().toLocaleString());
  console.log(`workspace: ${root}`);
  console.log(`refresh: ${tickMs}ms`);

  printSection(
    "Current HUD",
    formatJson({
      last_turn_at: hud?.last_turn_at,
      turn_count: hud?.turn_count,
      last_agent_output: hud?.last_agent_output?.slice?.(0, 140) ?? hud?.last_agent_output,
    }),
  );

  printSection(
    "Session",
    formatJson({
      session_id: session?.session_id,
      started_at: session?.started_at,
      pid: session?.pid,
      cwd: session?.cwd,
      platform: session?.platform,
    }),
  );

  printSection(
    "Active states",
    formatJson({
      files: activeStateFiles(),
      skill_active: summarizeSkillActive(skillActive),
      team: summarizeTeamState(team),
      autopilot: summarizeSimpleState(autopilot),
      ralph: summarizeSimpleState(ralph),
      pipeline: summarizeSimpleState(pipeline),
      ecomode: summarizeSimpleState(ecomode),
      tmux_hook: summarizeSimpleState(tmuxHook),
      notify_hook: summarizeSimpleState(notifyHook),
      notify_fallback: {
        active: notifyFallback?.active ?? null,
        pid: notifyFallback?.pid,
        poll_ms: notifyFallback?.poll_ms,
        tracked_files: notifyFallback?.tracked_files,
        seen_turns: notifyFallback?.seen_turns,
        last_event_at: notifyFallback?.last_event_at,
        fallback_auto_nudge: notifyFallback?.fallback_auto_nudge
          ? {
              enabled: notifyFallback.fallback_auto_nudge.enabled,
              stall_ms: notifyFallback.fallback_auto_nudge.stall_ms,
              last_tick_at: notifyFallback.fallback_auto_nudge.last_tick_at,
              last_reason: notifyFallback.fallback_auto_nudge.last_reason,
            }
          : null,
        leader_nudge: notifyFallback?.leader_nudge
          ? {
              enabled: notifyFallback.leader_nudge.enabled,
              stale_threshold_ms: notifyFallback.leader_nudge.stale_threshold_ms,
              last_tick_at: notifyFallback.leader_nudge.last_tick_at,
              last_error: notifyFallback.leader_nudge.last_error,
            }
          : null,
        ralph_continue_steer: notifyFallback?.ralph_continue_steer
          ? {
              enabled: notifyFallback.ralph_continue_steer.enabled,
              active: notifyFallback.ralph_continue_steer.active,
              last_reason: notifyFallback.ralph_continue_steer.last_reason,
              last_state_check_at: notifyFallback.ralph_continue_steer.last_state_check_at,
            }
          : null,
      },
    }),
  );

  printSection(
    "Latest logs",
    formatJson({
      turns: turnLog ? { file: turnLog, lines: recentLines(turnLog, 5) } : null,
      omx: omxLog ? { file: omxLog, lines: recentLines(omxLog, 3) } : null,
      tmux_hook: tmuxLog ? { file: tmuxLog, lines: recentLines(tmuxLog, 5) } : null,
    }),
  );

  const hasDashboardData =
    exists(join(stateDir, "hud-state.json")) ||
    exists(join(stateDir, "session.json")) ||
    activeStateFiles().length > 0;
  if (!hasDashboardData) {
    console.log("\nNo OMX state files found yet.");
  }

  console.log("\nPress Ctrl+C to exit.");
}

render();
setInterval(render, tickMs);
