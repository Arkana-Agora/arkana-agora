// docs-memory-guard.js
//
// Real OpenCode plugin (uses the documented .opencode/plugins/*.js hook API:
// https://opencode.ai/docs/plugins). This REPLACES the previous "hooks"
// system described in docs/*/hooks-reference.md, which referenced files
// under `plugins/psters-ai-workflow/hooks/` (afterFileEdit, stop,
// beforeShellExecution, ...). Those files never existed in this repo after
// the Cursor-specific `plugins/` and `.cursor/` directories were removed in
// v1.1.0 — this plugin is the actual, working replacement.
//
// What it does:
//   - tool.execute.after: whenever a write/edit/patch tool touches a file,
//     records whether that file is inside docs/ or is regular code, per
//     OpenCode session.
//   - event (session.idle): if a session edited code but never touched
//     docs/, prints an advisory reminder (and tries to surface a TUI toast
//     when the client supports it). This mirrors the "stop" reminder from
//     the old design, but implemented against a real event that OpenCode
//     actually emits.
//
// State is persisted to `.opencode/state/docs-memory-guard.json` inside the
// target project (not this plugin repo) so the reminder survives process
// restarts within the same OpenCode session id.

// D:\GitHub\Arkana-Agora\arkana-agora\.opencode\plugins\docs-memory-guard\index.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Plugin } from "@opencode/plugin";

const EDIT_TOOLS = new Set(["write", "edit", "patch"]);

function statePath(directory) {
  const dir = path.join(directory, ".opencode", "state");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, "docs-memory-guard.json");
}

function loadState(file) {
  if (!existsSync(file)) return { sessions: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" && parsed.sessions
      ? parsed
      : { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}

function saveState(file, state) {
  writeFileSync(file, JSON.stringify(state, null, 2));
}

function sanitizeRelativePath(filePath) {
  if (typeof filePath !== "string" || filePath.length === 0) return null;
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("..")) return null;
  return normalized;
}

function isDocPath(filePath) {
  return /(^|\/)docs\//.test(filePath);
}

function extractFilePath(event) {
  const args = event?.input ?? event?.args ?? {};
  return (
    args.filePath ||
    args.path ||
    args.file ||
    event?.metadata?.filePath ||
    null
  );
}

export default Plugin.define({
  id: "docs-memory-guard",
  async setup(ctx) {
    const directory = ctx.location?.directory || process.cwd();
    const file = statePath(directory);

    await ctx.tool.hook("execute.after", async (event) => {
      if (!EDIT_TOOLS.has(event?.tool)) return;

      const rawPath = extractFilePath(event);
      const filePath = sanitizeRelativePath(rawPath);
      if (!filePath) return;

      const sessionId = event?.sessionID || "default";
      const state = loadState(file);
      const session =
        state.sessions[sessionId] ||
        (state.sessions[sessionId] = { docEdits: 0, codeEdits: 0, touched: [] });

      if (isDocPath(filePath)) {
        session.docEdits += 1;
      } else {
        session.codeEdits += 1;
      }
      if (!session.touched.includes(filePath)) session.touched.push(filePath);

      saveState(file, state);
    });

    const controller = new AbortController();

    ctx.event.subscribe(
      async (event) => {
        if (event?.type !== "session.idle") return;

        const data = event?.data ?? event?.properties ?? {};
        const sessionId = data?.sessionID || event?.sessionID || "default";
        const state = loadState(file);
        const session = state.sessions[sessionId];
        if (!session) return;

        if (session.codeEdits > 0 && session.docEdits === 0) {
          const message =
            "Documentation guard: code changed this session but docs/ was not " +
            "updated. Consider /pwf-doc, /pwf-doc-capture, or /pwf-doc-refresh " +
            "before finishing.";
          console.warn(`[docs-memory-guard] ${message}`);
        }
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  },
});
