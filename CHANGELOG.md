# Changelog

## [Unreleased]

### Added
- Delimited placeholder syntax with `%{name}` and delimited system variables
  with `@{name}` for schemas where the next literal starts with a letter,
  number, or underscore.
- In-app and documented privacy notice that filenames are handled locally in the
  browser and no data is uploaded to, processed by, or stored on a server.
- Browser-saved replacement rules that run after output rendering and before
  validation, preview, and script generation.
- Character replacement implementation plan document.
- Folder output paths in output schemas using `/`, with generated `mkdir -p`
  support for missing folders.
- Local static-server helper script.
- Static browser UI for folder selection, schema entry, preview, and script export.
- Schema parser for user placeholders, escaped percent signs, and output system variables.
- Rename planner with strict filename validation, conflict detection, and selectable rows.
- Bash script generator with dry-run default, `--force` apply mode, safe quoting, and temporary rename strategy.
- Documentation for schemas, safety, localization, and versioning.
- Dependency-free Node tests for core logic.

## [0.1.0] - 2026-05-12

### Added
- Initial product concept and BSD 2-Clause license.
