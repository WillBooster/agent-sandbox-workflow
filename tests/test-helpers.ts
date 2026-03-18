/** Test-only helpers for creating real Bun workspaces on disk. */
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeWorkspaceGitRepo } from "../src/services/workspace";

/** Creates a temporary directory for an integration test workspace. */
export function createTempProjectDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Seeds a minimal Bun + TypeScript project used by the Claude integration tests. */
export function seedBunProject(workspaceDir: string): void {
  mkdirSync(join(workspaceDir, "src"), { recursive: true });

  writeFileSync(
    join(workspaceDir, "package.json"),
    JSON.stringify(
      {
        name: "workflow-test-project",
        private: true,
        type: "module",
        scripts: {
          typecheck: "bunx tsc --noEmit",
          format: "bunx biome check --write .",
          test: "bun test",
        },
        devDependencies: {
          "@biomejs/biome": "^2.4.6",
          "@types/bun": "latest",
          typescript: "^5.9.3",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(workspaceDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          lib: ["ESNext"],
          target: "ESNext",
          module: "Preserve",
          moduleDetection: "force",
          allowJs: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          verbatimModuleSyntax: true,
          noEmit: true,
          strict: true,
          skipLibCheck: true,
        },
        include: ["**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(workspaceDir, "biome.json"),
    JSON.stringify(
      {
        $schema: "https://biomejs.dev/schemas/2.0.5/schema.json",
        formatter: {
          indentStyle: "space",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(join(workspaceDir, "README.md"), "# Workflow Test Project\n");

  initializeWorkspaceGitRepo(workspaceDir);
  execSync("bun install", { cwd: workspaceDir, stdio: "pipe" });
}
