/** 実ファイルを使う Node.js 統合テスト向けの補助関数。 */
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeWorkspaceGitRepo } from "../src/services/workspace";

/** 統合テスト用の一時ディレクトリを作成する。 */
export function createTempProjectDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Claude 統合テスト用の最小 Node.js プロジェクトを配置する。 */
export function seedNodeProject(workspaceDir: string): void {
  mkdirSync(join(workspaceDir, "src"), { recursive: true });

  writeFileSync(
    join(workspaceDir, "package.json"),
    JSON.stringify(
      {
        name: "workflow-test-project",
        private: true,
        type: "module",
        scripts: {
          format: "biome check --write .",
          test: "vitest run",
        },
        devDependencies: {
          "@biomejs/biome": "^2.4.6",
          "@types/node": "^24.5.2",
          typescript: "^5.9.3",
          vitest: "^3.2.4",
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
  execSync("npm install", { cwd: workspaceDir, stdio: "pipe" });
}
