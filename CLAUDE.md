@AGENTS.md

## Plan

The plan for this product lives in Plania (MCP server `plania`, project `filmia`), not in this repo.
- Start: `get_next` or `get_resume` + `get_project` + `get_memory`, then `get_task`.
- Claim: `set_task` status "In progress", note "claimed by <agent>".
- Finish a phase: `set_task` status "In review" with branch, pr_url and a note
  `Result: <✓|⚠|✗> <unit|integration|test|live|grep|subagent> — <cite>`; then `update_resume`.
- Never mark Done. Jorge does that after merging.
- Decisions: `add_decision` with one line; the full ADR stays in `docs/adr/`.
