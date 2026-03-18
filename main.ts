import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const BACKLOG_BASE_URL = "https://willbooster.github.io/agent-sandbox-backlog";
const WORKSPACE_DIR = resolve("workspace");
const DIST_DIR = resolve("dist");

// ---------- Types ----------

interface TicketSummary {
  id: number;
  title: string;
}

interface TicketDetail {
  id: number;
  title: string;
  body: string;
}

// ---------- Helpers ----------

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function fetchTickets(): Promise<TicketSummary[]> {
  const url = `${BACKLOG_BASE_URL}/api/tickets.json`;
  log(`Fetching ticket list from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tickets: ${res.statusText}`);
  const data = (await res.json()) as { tickets: TicketSummary[] };
  log(`Found ${data.tickets.length} ticket(s)`);
  return data.tickets;
}

async function fetchTicketDetail(id: number): Promise<TicketDetail> {
  const url = `${BACKLOG_BASE_URL}/api/tickets/${id}.json`;
  log(`Fetching detail for ticket #${id} from ${url}`);
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch ticket #${id}: ${res.statusText}`);
  const data = (await res.json()) as TicketDetail;
  log(`Ticket #${id}: ${data.title}`);
  return data;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

function copyToDistDir(): void {
  // Remove old dist to ensure deleted files don't linger
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });
  cpSync(WORKSPACE_DIR, DIST_DIR, {
    recursive: true,
    filter: (src) => !src.includes("/.git") && !src.includes("/node_modules"),
  });
  log(`Copied workspace to ${DIST_DIR}`);
}

function hasScript(name: string): boolean {
  try {
    const pkgPath = join(WORKSPACE_DIR, "package.json");
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return !!pkg.scripts?.[name];
  } catch {
    return false;
  }
}

// ---------- Agent helpers ----------

async function runAgent(
  prompt: string,
  cwd: string,
): Promise<{ result: string; isError: boolean }> {
  log(`[Agent] Starting agent in ${cwd}`);
  log(`[Agent] Prompt: ${prompt.slice(0, 100)}...`);

  try {
    const claudePath = execSync("which claude", { encoding: "utf-8" }).trim();
    const q = query({
      prompt,
      options: {
        cwd,
        model: "sonnet",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 30,
        pathToClaudeCodeExecutable: claudePath,
      },
    });

    let resultText = "";
    let isError = false;

    for await (const message of q) {
      const msg = message as SDKMessage;
      if (msg.type === "result") {
        if (msg.subtype === "success") {
          resultText = msg.result;
          log(
            `[Agent] Completed successfully (${msg.num_turns} turns, $${msg.total_cost_usd.toFixed(4)})`,
          );
        } else {
          isError = true;
          resultText =
            "errors" in msg
              ? (msg.errors as string[]).join("\n")
              : "Unknown error";
          log(`[Agent] Error: ${msg.subtype} - ${resultText.slice(0, 200)}`);
        }
      }
    }

    return { result: resultText, isError };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[Agent] Exception: ${errorMessage}`);
    return { result: errorMessage, isError: true };
  }
}

// ---------- Workflow steps ----------

async function implementTicket(
  ticket: TicketDetail,
  isFirstTicket: boolean,
): Promise<void> {
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(
      `--- Implementation attempt ${attempt}/${maxRetries} for ticket #${ticket.id} ---`,
    );

    // Step 1: Implement with agent
    const additionalInstruction = isFirstTicket
      ? `\n\nIMPORTANT: Since this is the first ticket, also define the following npm scripts in package.json:
- "typecheck": type-checking command using bunx tsc --noEmit
- "format": formatting/linting command using bunx biome check --write .
- "test": test command using bun test

Also set up biome.json for the project, and tsconfig.json if not present.
Make sure to install necessary devDependencies (@biomejs/biome, @types/bun, typescript).`
      : "";

    const implementPrompt = `You are implementing a software project. Here is the ticket:

Title: ${ticket.title}
Description:
${ticket.body}

${additionalInstruction}

Please implement this feature. Also write test code (using bun:test with import { test, expect, describe } from "bun:test") in files ending with .test.ts.

Use Bun as the runtime. Use TypeScript. Do not use external packages unless absolutely necessary — prefer built-in Bun APIs.
Do NOT use any git commands.`;

    log("Running implementation agent...");
    const implResult = await runAgent(implementPrompt, WORKSPACE_DIR);
    if (implResult.isError) {
      log(`Implementation agent error: ${implResult.result}`);
      continue;
    }
    log("Implementation agent completed.");

    // Step 2: Typecheck
    if (hasScript("typecheck")) {
      log("Running typecheck...");
      const tcResult = await runAgent(
        "Run `bun run typecheck` and fix any type errors. Do NOT use any git commands. Only fix issues, do not add new features.",
        WORKSPACE_DIR,
      );
      if (tcResult.isError) {
        log(`Typecheck agent error: ${tcResult.result}`);
        continue;
      }
      log("Typecheck passed.");
    }

    // Step 3: Format / Lint
    if (hasScript("format")) {
      log("Running format/lint...");
      const fmtResult = await runAgent(
        "Run `bun run format` and fix any formatting or lint issues that are not auto-fixed. Do NOT use any git commands. Only fix issues, do not add new features.",
        WORKSPACE_DIR,
      );
      if (fmtResult.isError) {
        log(`Format agent error: ${fmtResult.result}`);
        continue;
      }
      log("Format/lint passed.");
    }

    // Step 4: Test
    if (hasScript("test")) {
      log("Running tests...");
      const testResult = await runAgent(
        "Run `bun run test` and fix any test failures. Do NOT use any git commands. Only fix issues, do not add new features.",
        WORKSPACE_DIR,
      );
      if (testResult.isError) {
        log(`Test agent error: ${testResult.result}`);
        continue;
      }
      log("Tests passed.");
    }

    // Step 5: Code review by separate agent
    log("Running code review...");
    const reviewResult = await runAgent(
      `You are a code reviewer. Review the code in this project for:
- Correctness and potential bugs
- Code quality and readability
- Security issues
- Test coverage

Read the source files and test files, then provide your review.
If there are issues, clearly state what needs to be fixed.
If everything looks good, say "LGTM" (Looks Good To Me).
Do NOT use any git commands. Do NOT modify any files.`,
      WORKSPACE_DIR,
    );

    if (reviewResult.isError) {
      log(`Code review agent error: ${reviewResult.result}`);
      continue;
    }

    const reviewText = reviewResult.result;
    log(`Code review result: ${reviewText.slice(0, 200)}...`);

    // Check if review has issues
    const lgtm =
      reviewText.toUpperCase().includes("LGTM") ||
      reviewText.toUpperCase().includes("LOOKS GOOD");

    if (!lgtm) {
      log("Code review found issues. Evaluating review validity...");

      // Have another agent evaluate and apply (or rebut) the review
      const evalResult = await runAgent(
        `A code review was performed on this project. Here is the review:

---
${reviewText}
---

Please evaluate this review:
1. For each point raised, determine if it is valid and actionable.
2. If a point is valid, fix the code accordingly.
3. If a point is NOT valid (e.g., nitpicking, false positive, or would break functionality), generate a rebuttal comment explaining why the suggestion should not be applied. Print the rebuttal prefixed with "REBUTTAL:".

Do NOT use any git commands.`,
        WORKSPACE_DIR,
      );

      if (evalResult.isError) {
        log(`Review evaluation agent error: ${evalResult.result}`);
        continue;
      }

      log("Review evaluation completed. Re-running checks...");

      // Re-run checks after review fixes
      let checksPass = true;

      if (hasScript("typecheck")) {
        const tc2 = await runAgent(
          "Run `bun run typecheck`. If there are errors, fix them. Do NOT use any git commands.",
          WORKSPACE_DIR,
        );
        if (tc2.isError) {
          checksPass = false;
          log("Typecheck failed after review fixes.");
        }
      }

      if (checksPass && hasScript("format")) {
        const fmt2 = await runAgent(
          "Run `bun run format`. Fix any issues. Do NOT use any git commands.",
          WORKSPACE_DIR,
        );
        if (fmt2.isError) {
          checksPass = false;
          log("Format failed after review fixes.");
        }
      }

      if (checksPass && hasScript("test")) {
        const tst2 = await runAgent(
          "Run `bun run test`. If there are failures, fix them. Do NOT use any git commands.",
          WORKSPACE_DIR,
        );
        if (tst2.isError) {
          checksPass = false;
          log("Tests failed after review fixes.");
        }
      }

      if (!checksPass) {
        log("Checks failed after review fixes, retrying...");
        continue;
      }
    }

    log(`Ticket #${ticket.id} implementation completed successfully.`);
    return;
  }

  log(
    `WARNING: Ticket #${ticket.id} exceeded max retries (${maxRetries}). Moving on.`,
  );
}

// ---------- Main ----------

async function main(): Promise<void> {
  log("=== Agent Sandbox Workflow Started ===");

  ensureDir(WORKSPACE_DIR);

  // Initialize workspace as a git repo if needed (Claude Code requires it)
  if (!existsSync(join(WORKSPACE_DIR, ".git"))) {
    log("Initializing workspace as git repository...");
    execSync("git init", { cwd: WORKSPACE_DIR, stdio: "pipe" });
    execSync('git commit --allow-empty -m "init"', {
      cwd: WORKSPACE_DIR,
      stdio: "pipe",
    });
  }

  const tickets = await fetchTickets();

  for (const ticketSummary of tickets) {
    log(
      `\n========== Processing Ticket #${ticketSummary.id}: ${ticketSummary.title} ==========`,
    );

    const ticket = await fetchTicketDetail(ticketSummary.id);
    const isFirstTicket = ticketSummary.id === tickets[0]?.id;

    await implementTicket(ticket, isFirstTicket);

    // Copy to dist after each ticket
    copyToDistDir();

    log(`========== Ticket #${ticketSummary.id} done ==========\n`);
  }

  log("=== All tickets processed ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
