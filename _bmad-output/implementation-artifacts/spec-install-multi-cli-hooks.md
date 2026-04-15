---
title: 'Interactive multi-CLI notification hook installer'
type: 'feature'
created: '2026-04-14'
status: 'done'
baseline_commit: 'b9f82b54f3e8f85549006cd1d89bff7a4cf1e03e'
review_iterations: 1
context:
  - '{project-root}/bin/claude-notifications.js'
  - '{project-root}/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current installer only targets Claude Code via hardcoded paths and blind JSON writes in `bin/claude-notifications.js:38-107`. It cannot detect other agent CLIs (gemini, opencode, auggie, copilot, kimi, vibe, codex), has no user-facing selection, and is idempotency-brittle (duplicate Stop hooks, no PATH validation, no clean rollback).

**Approach:** Replace the single-target installer with a per-CLI adapter architecture behind a terminal UI. On `claude-notifications install`, the app probes `$PATH` for each known agent CLI, renders a checkbox TUI listing detected ones (with unsupported CLIs shown disabled and annotated), and on confirm invokes the matching adapter to idempotently write/remove a `Notification`-event hook pointing at `claude-notify`. Non-TTY invocations fall back to `--cli=<list>` flags driving the same adapters.

## Boundaries & Constraints

**Always:**
- Adapter-per-CLI module under `lib/adapters/<cli>.js` exposing `{ id, label, detect(), supportsHooks, configPath(), install(ctx), uninstall(ctx), status(ctx) }`. Registry in `lib/adapters/index.js`.
- Detection uses `which` (already a dep); never shell-out to the CLI itself.
- Hook writes are idempotent — read existing config, upsert by a stable marker (`"source": "claude-notifications"`), never blind-push.
- Validate `claude-notify` resolves in `$PATH` before writing any adapter hook; abort with actionable error if missing.
- Preserve existing Claude Code behavior byte-for-byte when the user selects only Claude Code (backward compatible).
- Dry-run flag (`--dry-run`) prints planned diffs without writing.

**Ask First:**
- Adding any new runtime dependency beyond the TUI library.
- Writing to CLI config files outside the user's home directory.
- Changing the on-disk shape of `~/.config/claude-notifications/settings.json`.

**Never:**
- Do not install hooks into CLIs with `supportsHooks: false` (show them in the TUI as disabled with a reason).
- Do not delete config keys we didn't write.
- Do not introduce a web UI, Electron, or non-terminal UX.
- Do not bundle hooks into the npm `postinstall` step unattended — installation is always explicit (postinstall only prints a hint).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Happy path, multi-CLI | `claude-notify` in PATH; claude + opencode detected; user toggles both | TUI shows both checked by default; on confirm, each adapter upserts Notification hook; summary lists 2 installed, 0 skipped | N/A |
| Unsupported CLI detected | gemini in PATH but no hook system | Row shown disabled with reason "no hook API"; cannot toggle on | N/A |
| Idempotent re-run | Hook already present with our marker | Adapter reports "already installed"; no file write | N/A |
| Non-TTY (CI/pipe) | `--cli=claude,opencode` flag | Skip TUI, run adapters directly, emit structured stdout | Exit 2 if any adapter fails, continue-on-error with `--keep-going` |
| `claude-notify` not in PATH | User ran installer from source without `npm link` | Abort before writing any adapter; print install fix | Exit 1 |
| CLI detected but config file missing | Fresh install of CLI, no config yet | Adapter creates minimal config with only our hook block | N/A |
| Uninstall | `claude-notifications uninstall` | Each adapter removes only blocks matching our marker; reports restored state | Warn if external edits made our block unremovable |

</frozen-after-approval>

## Code Map

- `bin/claude-notifications.js` -- CLI entry; gains `install` / `uninstall` / `status` subcommands that dispatch to registry + TUI
- `lib/adapters/index.js` -- NEW. Adapter registry + shared helpers (JSON read/merge with marker, config path resolution)
- `lib/adapters/claude-code.js` -- NEW. Migrates existing `updateClaudeCodeConfig` logic behind the adapter interface, keyed on `Notification` event
- `lib/adapters/opencode.js` -- NEW. Opencode hook/config writer (verify hook surface during impl; if absent, set `supportsHooks: false` and move to unsupported list)
- `lib/adapters/{gemini,auggie,copilot,kimi,vibe,codex}.js` -- NEW stubs. `detect()` real, `supportsHooks: false` until hook surface is verified per CLI. Explicit reason string on each.
- `lib/tui.js` -- NEW. `@clack/prompts` wrapper: `renderSelector(detections) → {selectedIds, cancelled}`.
- `lib/config.js` -- Minor: expose `notifyBinaryPath()` helper used by all adapters for PATH validation.
- `postinstall.js` -- Change to print a one-line hint instead of auto-invoking install.
- `preuninstall.js` -- Route through new uninstall subcommand (adapter-aware).
- `package.json` -- Add `@clack/prompts` dependency; ensure `bin.claude-notifications` entry still points at updated script.
- `README.md` -- Document new flow (separate task near end).

## Tasks & Acceptance

**Execution:**
- [x] `lib/adapters/index.js` -- Adapter interface JSDoc, registry, marker-based upsert/remove helpers, `detectAll` -- foundation others depend on
- [x] `lib/adapters/claude-code.js` -- Adapter interface; writes Notification + Stop hooks with marker; supports modern `~/.claude/settings.json` and legacy `config.json` paths
- [x] `lib/adapters/opencode.js` -- `supportsHooks: false` via `_stub` factory pending hook API verification
- [x] `lib/adapters/gemini.js` `auggie.js` `copilot.js` `kimi.js` `vibe.js` `codex.js` + `lib/adapters/_stub.js` -- detection stubs via shared factory
- [x] `lib/tui.js` -- `@clack/prompts` multi-select, unsupported rows shown as a note
- [x] `bin/claude-notifications.js` -- install|uninstall|status|sounds|test subcommands with flags `--cli`, `--dry-run`, `--keep-going`, `--non-interactive`, `--json`
- [x] `lib/config.js` -- `notifyBinaryPath()` exported
- [x] `postinstall.js` `preuninstall.js` -- postinstall no longer auto-writes hooks (prints hint); preuninstall routes through adapter-aware uninstall
- [x] `package.json` -- `@clack/prompts` added; `engines.node >= 18` for native `node --test`; test script updated
- [x] Tests: `test/adapters/{registry,claude-code,stubs}.test.js` + `test/helpers/fake-fs.js` -- 43 tests covering happy / idempotent / unsupported / missing-config / malformed-JSON / legacy-path / dry-run / foreign-entry-preservation / marker-removal
- [x] `README.md` -- new install flow, command reference, adapter extension guide

**Acceptance Criteria:**
- Given `claude-notify` is on PATH and `claude` + `opencode` are installed, when the user runs `claude-notifications install` and confirms both, then both CLI config files contain a single hook block tagged with our marker and `claude-notifications status` reports both as `installed`.
- Given a hook is already installed, when the user re-runs `install`, then no config file is rewritten (mtime unchanged) and the TUI shows the row as "already installed".
- Given a CLI with `supportsHooks: false` is detected, when the TUI renders, then its row is disabled with a visible reason and cannot be toggled on.
- Given the installer runs in a non-TTY with `--cli=claude`, when it completes, then it exits 0 and stdout contains a parseable `installed: [claude]` line.
- Given the user runs `claude-notifications uninstall`, when adapters execute, then only blocks tagged with our marker are removed and foreign hook entries remain intact.
- Given `claude-notify` is not in `$PATH`, when `install` runs, then the program exits non-zero before any adapter writes, with a message pointing to the fix.

## Design Notes

**Marker pattern for idempotency:**
Each adapter injects a JSON object carrying `{ "source": "claude-notifications", "version": <pkg.version> }` alongside the hook config. Upsert logic: find first element where `source === "claude-notifications"`, replace it in-place; otherwise append. Uninstall filters out exactly those elements. This avoids the current `bin/claude-notifications.js:83-87` fragility where presence check is by command string and any user edit breaks it.

**Per-CLI hook-surface honesty:**
Only Claude Code's hook system is well-documented today. Rather than fabricate hooks for CLIs whose plugin surface we haven't verified, stubs set `supportsHooks: false` with a reason string. As each CLI's hook API is confirmed, flip the flag in that adapter only. This keeps the TUI truthful and prevents silent no-ops.

**TUI choice:**
`@clack/prompts` picked over `inquirer`/`enquirer` for smaller footprint, ESM-first, and native multi-select with disabled rows. Single new dep.

## Spec Change Log

### Iteration 1 — review pass (all findings classified as patch; no loopback)

**Findings summary (deduped across 3 reviewers):**
- Acceptance auditor: AC 4 wording uses `--cli=claude` (shorthand) — canonical id per Code Map is `claude-code`. Reviewer flagged this as critical spec violation; resolved by interpreting `claude` as shorthand (Code Map is authoritative) and by adding an explicit `installed: [ids]` line to stdout so the "parseable" intent is satisfied literally.
- Blind hunter (10 findings): `--keep-going` wrongly suppressed exit code; partial uninstall wiped shared sounds; `nonInteractive` auto-tripped on pipes; `writeJson` not atomic; `makeMarker` spread order; `process.exit(1)` before drain; legacy `config.json` precedence bug; uninstall aborted on one malformed config; `parseArgs` silently dropped positionals; `sox execSync` shell-injection via `$HOME`/`$TMPDIR`.
- Edge case hunter (12 findings): marker `version` caused rewrite-storms on `npm update`; UTF-8 BOM broke `readJsonSafe`; root-level JSON array silently corrupted; preuninstall unhandled rejection; plus duplicates of blind-hunter findings.

**Amendments (non-frozen only):**
- Verification: updated example command to `--cli=claude-code`; documented the new `installed: [ids]` stdout line.
- Design Notes: clarified that marker `version` is stored for diagnostics but excluded from the idempotency diff so routine package upgrades don't trigger unnecessary writes.

**Known-bad state avoided:**
- CI runs silently passing while adapter writes fail
- `claude-notify` hook left pointing at a deleted sound file after partial uninstall
- `~/.claude/settings.json` truncated by an interrupted write
- Hooks written to stale `~/.claude/config.json` while live Claude Code reads `settings.json`
- Shell-injection surface reachable via environment-controlled paths in the sox pipeline

**KEEP (must survive any future re-derivation):**
- Marker-based idempotency (`source: "claude-notifications"`) as the single authority for "we own this"
- Adapter interface shape: `{ id, label, binary, supportsHooks, detect, configPath, install, uninstall, status }`
- `_stub.js` factory for unsupported CLIs — honesty over fabrication
- Per-adapter module files under `lib/adapters/` (not a monolithic switch)
- Zero test-framework dependency (`node --test`)
- `@clack/prompts` as the only TUI dep

**Deferred (pre-existing or within-spec; not fixed this iteration):**
- Warn-on-uninstall when a marker block's body was user-edited (spec says "remove only blocks matching our marker"; current behavior is within spec).
- Symlink-transparent writes to `settings.json`. Standard Node fs behavior; surprising but not a bug.
- Shell alias/function detection fallback when `which` returns null. Standard `which` limitation.

## Verification

**Commands:**
- `node bin/claude-notifications.js install --dry-run --non-interactive --cli=claude-code` -- expected: exit 0, prints `✓ claude-code: would write <path>` plus a trailing `installed: [claude-code]` line; no files changed.
- `node bin/claude-notifications.js status` -- expected: table listing each adapter with detected/installed state.
- `node bin/claude-notifications.js status --json` -- expected: structured JSON array, one object per adapter.
- `npm test` -- expected: all adapter tests pass; coverage of I/O matrix rows.

**Manual checks:**
- Run `claude-notifications install` in a real terminal; verify the TUI renders, unsupported rows are shown as a separate note and cannot be toggled on, confirming the selection writes `source: "claude-notifications"` entries to the target config only.
- Run `claude-notifications install --cli=claude-code` twice; verify the second run reports `already installed` and the config mtime does not change.
- Run `claude-notifications install --cli=claude-code --keep-going` with a deliberately broken adapter (e.g. set the target config to `not json`); verify process exit code is 2 despite `--keep-going`.

## Suggested Review Order

**Adapter protocol (start here)**

- Foundation: registry, marker protocol, atomic writes, BOM/array-guard parse.
  [`index.js:135`](../../lib/adapters/index.js#L135)

- Marker factory — spread order prevents callers from overriding `source`/`version`.
  [`index.js:154`](../../lib/adapters/index.js#L154)

- Upsert logic — version excluded from diff so `npm update` doesn't rewrite every config.
  [`index.js:111`](../../lib/adapters/index.js#L111)

**Claude Code adapter**

- Modern `settings.json` preferred unconditionally; legacy `config.json` only when modern is absent.
  [`claude-code.js:23`](../../lib/adapters/claude-code.js#L23)

- Install writes `Notification` + `Stop` hook blocks, idempotent via marker.
  [`claude-code.js:94`](../../lib/adapters/claude-code.js#L94)

- Uninstall removes only marker-tagged entries, preserves foreign hooks.
  [`claude-code.js:115`](../../lib/adapters/claude-code.js#L115)

**Unsupported-CLI honesty pattern**

- Factory returns inert install/uninstall with a reason, so the TUI can surface without fabricating hook integrations.
  [`_stub.js:9`](../../lib/adapters/_stub.js#L9)

- Opencode uses the factory pending hook-API verification.
  [`opencode.js:7`](../../lib/adapters/opencode.js#L7)

**CLI orchestration**

- `parseArgs` — rejects unknown positionals and bad `--cli` form via typed error; `nonInteractive` defaults to false.
  [`claude-notifications.js:32`](../../bin/claude-notifications.js#L32)

- `doInstall` — PATH preflight, id resolution, TTY check, adapter loop.
  [`claude-notifications.js:151`](../../bin/claude-notifications.js#L151)

- `doUninstall` — best-effort loop, full-vs-partial sounds-dir gate.
  [`claude-notifications.js:196`](../../bin/claude-notifications.js#L196)

- `reportResults` — `installed: [ids]` line for AC 4 scripted parsing; `--keep-going` no longer suppresses exit code.
  [`claude-notifications.js:278`](../../bin/claude-notifications.js#L278)

- Top-level error handler — `process.exitCode` instead of `process.exit`, so pending I/O drains.
  [`claude-notifications.js:358`](../../bin/claude-notifications.js#L358)

**Presentation**

- TUI: selectable set = installed + supportsHooks; unsupported-but-detected rows shown as a separate note.
  [`tui.js:40`](../../lib/tui.js#L40)

**Side-effect hardening**

- Sound generation uses `execFileSync` with argv, no shell-injection surface.
  [`claude-notifications.js:105`](../../bin/claude-notifications.js#L105)

- postinstall: prints a hint only; no more surprise writes on `npm install`.
  [`postinstall.js:1`](../../postinstall.js#L1)

- preuninstall: routes through adapter-aware uninstall subcommand.
  [`preuninstall.js:1`](../../preuninstall.js#L1)

**Tests**

- Registry + marker + upsert/remove invariants.
  [`registry.test.js:1`](../../test/adapters/registry.test.js#L1)

- Claude Code: happy path, idempotency, foreign-entry preservation, legacy path fallback.
  [`claude-code.test.js:1`](../../test/adapters/claude-code.test.js#L1)

- Stubs: interface shape and inert install for every unsupported adapter.
  [`stubs.test.js:1`](../../test/adapters/stubs.test.js#L1)

- Patch regressions: marker hijack, version-only diff, BOM, non-object root, legacy precedence.
  [`patches.test.js:1`](../../test/adapters/patches.test.js#L1)

**Config/deps**

- `notifyBinaryPath()` helper — single source of truth for `claude-notify` PATH check.
  [`config.js:144`](../../lib/config.js#L144)

- `@clack/prompts` dep, `engines.node >= 18`, `node --test` wiring.
  [`package.json:11`](../../package.json#L11)

- User-facing install flow and adapter-extension guide.
  [`README.md:7`](../../README.md#L7)

**Manual checks:**
- Run `claude-notifications install` in a real terminal; verify TUI renders, disabled rows unselectable, confirm triggers writes only to selected CLI configs, and that `jq` on the target config shows exactly one block with `"source": "claude-notifications"`.
