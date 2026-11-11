// commit-convention-guard.js
//
// Real OpenCode plugin (tool.execute.before hook). Replaces the previous,
// non-existent `commit-convention-reminder.mjs` referenced by
// docs/*/hooks-reference.md and the old (dead) hooks test.
//
// Default behavior is advisory-only (console.warn), matching this repo's
// stated philosophy that "hooks are reinforcement, not blockers" (see
// docs/*/hooks-reference.md and AGENTS.md). Set
// PWF_STRICT_COMMIT_CONVENTION=1 in the environment to hard-block commits
// whose message is missing the required `[TICKET-XXXX]` prefix.

// commit-convention-guard.js
import { Plugin } from "@opencode/plugin";

const TICKET_PATTERN = /\[[A-Z][A-Z0-9]*-\d+\]/;

function extractInlineMessage(command) {
  const match = command.match(/-m\s+"([^"]*)"|-m\s+'([^']*)'/);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

export default Plugin.define({
  id: "commit-convention-guard",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", async (event) => {
      if (event.tool !== "bash") return;

      const command = event.input?.command ?? event.args?.command;
      if (!command || !/\bgit\s+commit\b/.test(command)) return;

      const message = extractInlineMessage(command);
      if (!message) return;

      if (TICKET_PATTERN.test(message)) return;

      const warning =
        `Commit reminder: message is missing a [TICKET-XXXX] prefix ` +
        `required by AGENTS.md: "${message}"`;

      if (process.env.PWF_STRICT_COMMIT_CONVENTION === "1") {
        throw new Error(
          `${warning} Set PWF_STRICT_COMMIT_CONVENTION=0 (or unset it) to ` +
            `only warn instead of blocking.`
        );
      }

      console.warn(`[commit-convention-guard] ${warning}`);
    });
  },
});

