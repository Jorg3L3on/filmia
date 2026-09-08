import { spawnSync } from "node:child_process";
import path from "node:path";

const offlineScripts = [
  "verify-nav.ts",
  "verify-polish-14.ts",
  "verify-series-status.ts",
  "verify-database-url.ts",
  "verify-streaming-platforms.ts",
  "verify-watch-providers.ts",
  "verify-diary-calendar.ts",
  "verify-diary-picks.ts",
  "verify-tags.ts",
  "verify-profile.ts",
  "verify-mark-seen.ts",
  "verify-motion.ts",
  "verify-title-overview.ts",
];

const tsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");

for (const file of offlineScripts) {
  const result = spawnSync(tsx, [path.join("scripts", file)], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
