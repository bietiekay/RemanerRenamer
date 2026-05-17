# Implement RemanerRenamer Static Rename Script Generator

## Summary
Build the concept as a dependency-light, browser-only static web app using `HTML`, `CSS`, and vanilla `JavaScript`. The app will never rename files directly. It will load filenames through a folder picker, parse user schemas, preview rename plans, block unsafe output, and generate an auditable Bash script that dry-runs by default and only renames with `--force`.

Current repo state: only `concept.md`, `LICENSE.md`, `.DS_Store`, and git metadata exist. Implementation will add the app and docs from scratch while preserving the BSD-2-Clause license.

## Key Decisions
- App type: static web app, no backend, no Electron/Tauri, no browser write APIs.
- App name: use **Schema Rename Script Generator** in v1 UI; repo/package identity can remain `RemanerRenamer`.
- Placeholder syntax: `%name` and `%{name}` where names match `[A-Za-z][A-Za-z0-9_]*`; `%%` means literal `%`.
- System variables: `@ext`, `@basename`, `@filename`, plus delimited `@{ext}` style; reserve `@n` for later/auto-numbering behavior.
- Extension mode: default to `preserve`; provide `full filename` as an advanced option.
- v1 scope: non-recursive rename plans only, no subfolder output, no direct file moves.
- Conflict behavior: default `block`; include auto-number only if it can be implemented without weakening validation.
- Filename validation: strict cross-platform blocking for unsafe names.
- Script behavior: every invocation except `bash rename.sh --force` or `./rename.sh --force` is dry-run.

## Implementation Changes
- Create the static app files: `index.html`, `style.css`, and `app.js`.
- Add documentation: `README.md`, `CHANGELOG.md`, `SCHEMA.md`, `SAFETY.md`, `LOCALIZATION.md`, and `VERSIONING.md`.
- In `app.js`, keep logic separated into sections or small modules for:
  - UI state and rendering
  - schema tokenization and validation
  - filename matching
  - output rendering
  - rename plan generation
  - conflict and filename validation
  - Bash script generation
  - copy/download actions
- Use `<input type="file" webkitdirectory multiple>` to load files and build file entries with name, relative path, basename, extension, size, modified date, and selected state.
- Match input schemas against either basename or full filename depending on extension mode.
- Block adjacent placeholders such as `%a%b`; allow repeated placeholders only when repeated captures match exactly.
- Validate output schemas before rendering: unknown placeholders, unsupported system variables, empty output, invalid characters, reserved names, trailing dots/spaces, long names, duplicate targets, overwrite risks, and case-insensitive conflicts.
- Generate scripts with quoted Bash arrays, `set -euo pipefail`, validation before mutation, `mv --`, temporary rename pass, final rename pass, readable dry-run output, and strict `--force` apply mode.

## User Experience
- First screen is the actual tool, not a landing page.
- Main flow:
  1. Choose folder.
  2. Enter input schema.
  3. Preview captures.
  4. Enter output schema.
  5. Preview old-to-new mappings.
  6. Select included files.
  7. Generate, copy, or download `rename.sh`.
- Preview table shows selected state, status, old filename, new filename, captures, warnings, and errors.
- Script controls remain disabled until the selected plan has no blocking errors.
- Visible strings go through a small English `STRINGS` dictionary so localization can be added later.

## Test Plan
- Add focused manual and lightweight automated checks for pure logic where practical.
- Cover schema parsing: valid placeholders, delimited placeholders, invalid placeholders, escaped `%`, adjacent placeholder blocking, repeated placeholders.
- Cover matching/rendering: preserve extension mode, full filename mode, unknown output placeholders, system variables.
- Cover validation: invalid filename characters, empty output, reserved names, trailing spaces/dots, duplicate outputs, overwrite risks, case-only conflicts, source-target swaps.
- Cover script generation: dry-run default, `--force` only apply mode, safe quoting for spaces/single quotes/leading dashes, temporary rename strategy.
- Verify locally by opening `index.html` directly and, if needed, serving with `python3 -m http.server 8080`.

## Acceptance Criteria
- The app opens without a build step.
- A selected folder produces a visible file list and rename preview.
- The example from `concept.md` works:
  - input `%{a}-%{b}-%{c} - %{title} - %{suffix}`
  - output `%{c}%{b}%{a} - %{title}.@ext`
  - result `01052026 - Das ist ein.mp4`
- Unsafe or ambiguous plans block script generation.
- Generated `rename.sh` is readable, copyable, downloadable, and dry-runs by default.
- Real renames are only possible with `--force`.
- Documentation clearly explains schemas, safety, script usage, and project versioning.

## Assumptions
- v1 is English-only but localization-ready.
- Recursive folder renaming and subfolder output are intentionally deferred.
- Auto-numbering is optional for v1; blocking conflicts is the required safe baseline.
- The generated script assumes it is run from the selected target folder and uses relative filenames only.
