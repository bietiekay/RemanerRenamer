# Character Replacement Pair List

## Summary
Add a user-maintained replacement list that runs after the output schema renders and before validation, conflict detection, preview, and script generation. Replacements are literal, ordered, case-sensitive substring rules saved in the browser. They apply to each rendered path segment, so folder separators from `/` are preserved and cannot be created or removed by replacement rules.

## Concept
- The output schema remains responsible for structure: `%a/%d/%t.@ext`.
- Replacement rules clean or normalize the rendered text as the final browser-side transformation:
  - render output schema
  - split rendered target path by `/`
  - apply enabled replacement rules to each folder/filename segment, top-to-bottom
  - rejoin with `/`
  - validate final target path
- Example:
  - output schema: `%a/%d/%t.@ext`
  - rules: `& -> and`, `: -> -`, double space `  ->  `
  - rendered raw path: `AC/DC/2026/One & Two: Test.mp4`
  - final target path: `AC/DC/2026/One and Two- Test.mp4`
- The generated Bash script embeds only final target paths. It does not re-run replacement logic, which keeps script behavior auditable and identical to preview.

## Key Changes
- Add a **Replacements** UI section near the output schema with:
  - enabled checkbox
  - find text
  - replace text
  - move up/down controls
  - delete control
  - add rule button
  - clear rules button
- Persist replacement rules in `localStorage` under a versioned key such as `remanerRenamer.replacements.v1`.
- Add data fields:
  - `ReplacementRule { id, enabled, find, replace }`
  - `PreviewRequest.replacements`
  - `RenamePlanItem.rawTargetRelativePath`
  - `RenamePlanItem.targetRelativePath`
- Add pure logic helpers:
  - `validateReplacementRules(rules)`
  - `applyReplacementRulesToSegment(value, rules)`
  - `applyReplacementRulesToTargetPath(path, rules)`
- Rule behavior:
  - enabled rules run top-to-bottom
  - each rule replaces all literal occurrences
  - matching is case-sensitive
  - empty `find` is invalid for enabled rules
  - empty `replace` is allowed for removal
  - replacement text containing `/` is invalid, preserving schema-defined folder structure
  - disabled invalid rows are ignored
- Keep current target path validation after replacements, so replacements may clean otherwise-invalid captures such as `:` or `?`, but final output still must be safe.

## Documentation
- Update `README.md` with a short replacement example.
- Add a replacement section to `SCHEMA.md` explaining order, literal matching, path segment scope, and persistence.
- Update `SAFETY.md` to clarify that replacements are previewed and validated before script generation.
- Update `CHANGELOG.md` under `[Unreleased] > Added`.

## Test Plan
- Add logic tests for:
  - exact ordered replacements
  - substring replacement across folder and filename segments
  - `/` separators preserved
  - empty replacement removes text
  - empty enabled `find` blocks generation
  - disabled empty `find` is ignored
  - replacement containing `/` blocks generation
  - replacement can clean invalid output characters before `validateTargetPath`
  - generated script contains final replaced target paths only
- Run:
  - `node tests/logic.test.js`
  - `git diff --check`
- Browser smoke test:
  - load the static app
  - add replacement rules
  - confirm preview updates and no console errors

## Assumptions
- Replacement list is saved in the current browser via `localStorage`.
- Replacements apply to folder names and final filenames, but not to `/` separators.
- Replacements are literal, ordered, and case-sensitive.
- No regex mode, import/export, or case-insensitive toggle in this version.
