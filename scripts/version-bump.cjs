#!/usr/bin/env node
/**
 * Auto version bump for Cardstock (adapted from the Porhi/learning repo).
 *
 * Scheme (single-decimal MAJOR.MINOR, minor 0-9):
 *   - MINOR change  → +0.1   (0.9 → 1.0 carries automatically)
 *   - MAJOR change  → jump to the next whole number (e.g. 1.4 → 2.0)
 *
 * One bump per push. A push counts as MAJOR if ANY of its commits is a
 * Conventional-Commits breaking change — a `type!: ...` subject (e.g. `feat!:`)
 * or a `BREAKING CHANGE` footer; otherwise it's a MINOR bump. A push that
 * contains only release commits (`chore(release): ...`) or nothing meaningful
 * does not bump.
 *
 * Source of truth: app/src/version.json (the app footer reads it). We do NOT
 * touch app/package.json here — changing its "version" without also updating
 * package-lock.json would make a later `npm ci` fail the in-sync check.
 *
 * Range: set BUMP_RANGE="<before>..<sha>" (CI passes github.event.before..github.sha).
 * Falls back to the latest commit when the range is empty/invalid.
 *
 * Output: prints the resulting version, and writes `bumped=<true|false>` and
 * `version=<x.y>` to $GITHUB_OUTPUT when running in CI.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'app/src/version.json');

const RECORD_SEP = '\x1e';

function commitMessages() {
  const range = (process.env.BUMP_RANGE || '').trim();
  const zero = /^0+$/;
  const tryLog = (rev) =>
    execSync(`git log ${rev} --no-merges --format=%B${RECORD_SEP}`, { cwd: ROOT })
      .toString()
      .split(RECORD_SEP)
      .map((s) => s.trim())
      .filter(Boolean);
  if (range && !range.split('..').some((r) => zero.test(r))) {
    try { return tryLog(range); } catch { /* range invalid (e.g. force-push) — fall through */ }
  }
  try { return tryLog('-1'); } catch { return []; }
}

function classify(messages) {
  // Ignore our own release commits so re-runs never re-bump.
  const real = messages.filter((m) => !/^chore\(release\):/i.test(m));
  if (real.length === 0) return 'none';
  const isMajor = real.some((m) => /^[a-z]+(\([^)]*\))?!:/i.test(m) || /BREAKING[ -]CHANGE/.test(m));
  return isMajor ? 'major' : 'minor';
}

function nextVersion(current, kind) {
  const cur = parseFloat(current) || 0;
  if (kind === 'major') return (Math.floor(cur) + 1).toFixed(1); // 1.4 → "2.0"
  return (Math.round((cur + 0.1) * 10) / 10).toFixed(1);          // 1.0 → "1.1", 0.9 → "1.0"
}

function emitOutput(bumped, version) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `bumped=${bumped}\nversion=${version}\n`);
}

function main() {
  const { version: current } = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  const kind = classify(commitMessages());

  if (kind === 'none') {
    console.log(`No bump (no release-worthy commits). version stays ${current}`);
    emitOutput(false, current);
    return;
  }

  const next = nextVersion(current, kind);
  const obj = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  obj.version = next;
  fs.writeFileSync(VERSION_FILE, JSON.stringify(obj, null, 2) + '\n');

  console.log(`${kind} bump: ${current} → ${next}`);
  emitOutput(true, next);
}

main();
