/**
 * Checks out the pinned pret commits into data-src/ (sparse and shallow, so
 * only the data files are downloaded). Safe to re-run: a repo already at the
 * pinned commit is skipped.
 *
 * Usage: npm run fetch-sources
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { DATA_SRC_DIR, SOURCES, type SourceRepo } from "./sources";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function currentCommit(dir: string): string | null {
  try {
    return git(dir, "rev-parse", "HEAD");
  } catch {
    return null;
  }
}

export function repoDir(name: SourceRepo["name"]): string {
  return path.resolve(DATA_SRC_DIR, name);
}

function fetchRepo(repo: SourceRepo): void {
  const dir = repoDir(repo.name);

  if (currentCommit(dir) === repo.commit) {
    // Re-apply the sparse paths in case the list changed, then we're done.
    git(dir, "sparse-checkout", "set", "--no-cone", ...repo.paths);
    console.log(`✓ ${repo.name} already at ${repo.commit.slice(0, 7)}`);
    return;
  }

  if (!existsSync(path.join(dir, ".git"))) {
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "--quiet");
    git(dir, "remote", "add", "origin", repo.url);
  }

  console.log(`↓ ${repo.name} @ ${repo.commit.slice(0, 7)} …`);
  git(dir, "sparse-checkout", "set", "--no-cone", ...repo.paths);
  git(
    dir,
    "fetch",
    "--quiet",
    "--depth",
    "1",
    "--filter=blob:none",
    "origin",
    repo.commit,
  );
  git(dir, "checkout", "--quiet", "--force", "FETCH_HEAD");
  console.log(`✓ ${repo.name} checked out`);
}

export function fetchSources(): void {
  mkdirSync(DATA_SRC_DIR, { recursive: true });
  for (const repo of SOURCES) fetchRepo(repo);
}

// Run directly: `tsx scripts/import/fetch-sources.ts`
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename)
) {
  fetchSources();
}
