import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { verifyWorkspace } from "../src/steps/verify-workspace";
import { createTempProjectDir } from "./test-helpers";

function writePackageJson(
  workspaceDir: string,
  scripts: Record<string, string>,
): void {
  writeFileSync(
    join(workspaceDir, "package.json"),
    JSON.stringify(
      {
        name: "verify-workspace-test",
        private: true,
        scripts,
      },
      null,
      2,
    ),
  );
}

test(
  "verifyWorkspace runs npm scripts locally and succeeds on zero exit codes",
  async () => {
  const workspaceDir = createTempProjectDir("verify-pass-");
  mkdirSync(join(workspaceDir, "src"), { recursive: true });
  writePackageJson(workspaceDir, {
    format: 'node -e "process.exit(0)"',
    test: 'node -e "process.exit(0)"',
  });

  const result = await verifyWorkspace({ workspaceDir });

  expect(result.success).toBe(true);
  expect(result.steps).toHaveLength(2);
  expect(result.steps.every((step) => !step.isError)).toBe(true);
  },
  15_000,
);

test(
  "verifyWorkspace returns stdout and stderr when npm script fails",
  async () => {
  const workspaceDir = createTempProjectDir("verify-fail-");
  mkdirSync(join(workspaceDir, "src"), { recursive: true });
  writePackageJson(workspaceDir, {
    format:
      "node -e 'console.log(\"format failed\"); console.error(\"stderr details\"); process.exit(1)'",
    test: 'node -e "process.exit(0)"',
  });

  const result = await verifyWorkspace({ workspaceDir });

  expect(result.success).toBe(false);
  expect(result.steps).toHaveLength(1);
  expect(result.steps[0]?.name).toBe("format");
  expect(result.steps[0]?.isError).toBe(true);
  expect(result.steps[0]?.output).toContain("format failed");
  expect(result.steps[0]?.output).toContain("stderr details");
  },
  15_000,
);
