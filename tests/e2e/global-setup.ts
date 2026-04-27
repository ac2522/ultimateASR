import fs from "node:fs";
import path from "node:path";

// Verifies the dist/ + dist-electron/ build artifacts exist before any spec
// runs. Throws with a clear, actionable error if not — keeps CI failures
// understandable when someone forgets `pnpm build`.
export default function globalSetup(): void {
  const required = [
    "dist-electron/main/index.cjs",
    "dist-electron/preload/index.cjs",
    "dist/renderer/index.html",
  ];
  for (const rel of required) {
    if (!fs.existsSync(path.resolve(rel))) {
      throw new Error(
        `Missing build artifact: ${rel}. Run 'pnpm build' first.`,
      );
    }
  }
}
