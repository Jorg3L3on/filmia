<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Plan

The plan for this product lives in Plania (MCP server `plania`, project `filmia`), not in this repo.
Follow the protocol in the Plania server's instructions (sent on connect, versioned) and the project's rules and settings (`get_project`). Do not copy the protocol here: it changes in Plania.
- Start: `get_context` with your branch and worktree when you are on a branch; otherwise `get_resume`, then `get_task`.
- Never mark Done or Won't do: `request_approval`, then pass the `approval_id` Jorge grants.
- Put "Plania: <KEY>" in every PR body.
