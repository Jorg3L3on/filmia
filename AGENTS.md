<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Plan

The plan for this product lives in Plania (MCP server `plania`, project `filmia`), not in this repo.
- Start: `get_next` or `get_resume` + `get_project` + `get_memory`, then `get_task`.
- Claim: `set_task` status "In progress", note "claimed by <agent>".
- Finish a phase: `set_task` status "In review" with branch, pr_url and a note
  `Result: <✓|⚠|✗> <unit|integration|test|live|grep|subagent> — <cite>`; then `update_resume`.
- Never mark Done. Jorge does that after merging.
- Decisions: `add_decision` with one line; the full ADR stays in `docs/adr/`.
