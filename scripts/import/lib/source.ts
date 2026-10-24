import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { DATA_SRC_DIR, type SourceRepo } from "../sources";
import { parseConstants, type Constants } from "./c-parse";

export type RepoName = SourceRepo["name"];

const utf8 = new TextDecoder("utf-8", { fatal: true });
const latin1 = new TextDecoder("latin1");

/** Reads a file from a checked-out repo. Most pret files are UTF-8; a few are Latin-1. */
export function readSource(repo: RepoName, relPath: string): string {
  const bytes = readFileSync(path.resolve(DATA_SRC_DIR, repo, relPath));
  try {
    return utf8.decode(bytes);
  } catch {
    return latin1.decode(bytes);
  }
}

export function sourceExists(repo: RepoName, relPath: string): boolean {
  try {
    readFileSync(path.resolve(DATA_SRC_DIR, repo, relPath));
    return true;
  } catch {
    return false;
  }
}

const constantsCache = new Map<RepoName, Constants>();

/** All numeric #defines and enum members from a repo's include/constants/. */
export function repoConstants(repo: RepoName): Constants {
  const cached = constantsCache.get(repo);
  if (cached) return cached;
  const dir = path.resolve(DATA_SRC_DIR, repo, "include/constants");
  const files = readdirSync(dir).filter((f) => f.endsWith(".h"));
  const constants = parseConstants(
    files.map((f) => readSource(repo, `include/constants/${f}`)),
  );
  constantsCache.set(repo, constants);
  return constants;
}
