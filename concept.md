# Web-Only Schema-Based Batch Rename Script Generator

## 1. Purpose

This document describes the product concept, architecture, user experience, schema logic, script generation model, safety rules, implementation plan, documentation plan, versioning strategy, and future roadmap for a web-only batch renaming application.

The application does **not** rename files directly.

Instead, it provides a browser-based UI where users can:

```text
Select a local folder in the browser
Define an input schema for existing filenames
Preview captured placeholder values
Define an output schema for new filenames
Preview old-to-new filename mappings
Detect conflicts and invalid output names
Generate a Bash-compatible rename script
Copy or download the script
Run the script manually in Terminal
```

The generated script must always run in **dry-run mode by default**.

It must only perform real renames when the user explicitly passes:

```bash
--force
```

Example:

```bash
bash rename.sh
```

Outputs the planned renames only.

```bash
bash rename.sh --force
```

Actually applies the renames.

---

## 2. Core Product Principle

The app is not a file-renaming tool that mutates the filesystem directly.

It is a **safe rename-plan generator**.

The core promise:

```text
Define what filenames mean.
Preview what will happen.
Generate an auditable script.
Rename only when explicitly forced.
```

---

## 3. Revised Architecture

```text
Browser-only web app
    ↓
User selects folder
    ↓
App reads file names from browser file input
    ↓
User defines input schema
    ↓
App extracts placeholders
    ↓
User defines output schema
    ↓
App previews old → new filenames
    ↓
App detects conflicts and warnings
    ↓
App generates Bash-compatible rename script
    ↓
User downloads or copies script
    ↓
User runs script in Terminal
    ↓
Script dry-runs by default
    ↓
Script only renames with --force
```

---

## 4. Technology Choice

The app should be implemented as a static web application.

Recommended first implementation:

```text
HTML
CSS
Vanilla JavaScript
```

No backend is required.

No desktop shell is required.

No native filesystem write access is required.

No app installation is required.

Optional later development stack:

```text
Vite
TypeScript
ESLint
Prettier
Playwright
```

But the first implementation can remain dependency-light and portable.

---

## 5. Runtime Dependencies

For users:

```text
A modern browser
A terminal
Bash
```

No app install is required.

No local web server is strictly required, although local serving is recommended during development.

The web app can be opened as:

```text
index.html
```

For development, it can be served locally with:

```bash
python3 -m http.server 8080
```

Then opened at:

```text
http://localhost:8080
```

---

## 6. Core Files

The minimal implementation should consist of:

```text
index.html
style.css
app.js
README.md
CHANGELOG.md
SCHEMA.md
SAFETY.md
LOCALIZATION.md
VERSIONING.md
```

Optional later structure:

```text
src/
  app.js
  schema.js
  matcher.js
  renderer.js
  conflicts.js
  script-generator.js
  ui.js
  i18n.js
```

---

## 7. Browser Folder Selection

The primary folder-selection mechanism should be:

```html
<input type="file" webkitdirectory multiple>
```

This allows the user to select a folder and lets the browser expose the contained files to JavaScript as `File` objects.

Important:

```text
The browser usually does not expose the real absolute local folder path.
```

Instead, the app receives:

```text
file.name
file.webkitRelativePath
file.size
file.lastModified
```

This is enough to build a rename plan.

The generated script should assume that the user runs it from inside the target folder, or from the parent folder depending on the selected relative path mode.

Recommended v1 behavior:

```text
Generate a script that must be run from the selected folder.
Use relative filenames only.
Do not rely on absolute paths.
```

The generated script should clearly state this:

```bash
# Run this script from the folder containing the files.
# Example:
#   cd "/path/to/your/folder"
#   bash rename.sh
#   bash rename.sh --force
```

---

## 8. Browser File Access Rights

The web app should not attempt to directly rename files.

Reasons:

```text
Browser filesystem write access is inconsistent across browsers
Real local paths are intentionally hidden for privacy
Direct browser writes introduce avoidable permission complexity
Generated scripts are auditable
Manual execution keeps the user in control
Dry-run-by-default behavior is safer
```

The app only needs read access to the list of selected files.

This access is granted when the user selects a folder through the browser file picker.

---

## 9. Main User Workflow

```text
1. Open web app.
2. Choose folder.
3. App lists files.
4. Enter input schema.
5. App previews captured placeholders.
6. Enter output schema.
7. App previews old and new filenames.
8. App marks unmatched files, conflicts, and invalid targets.
9. User selects files to include.
10. User generates script.
11. User downloads or copies script.
12. User runs script without --force to dry-run.
13. User reviews script output.
14. User runs script with --force to apply.
```

---

## 10. Placeholder Model

Placeholders are fully user-defined.

The app must not attach semantic meaning to placeholder names.

Examples such as:

```text
%y
%m
%d
%t
%b
```

are only examples.

`%y` does not automatically mean “year”.

`%t` does not automatically mean “title”.

Any placeholder used in the input schema becomes available in the output schema.

---

## 11. Basic Example

### 11.1 Existing filename

```text
2026-05-01 - Das ist ein - Test.mp4
```

### 11.2 Input schema

```text
%y-%m-%d - %t - %b.mp4
```

### 11.3 Captured values

```text
%y = 2026
%m = 05
%d = 01
%t = Das ist ein
%b = Test
```

### 11.4 Output schema

```text
%d%m%y - %t.mp4
```

### 11.5 Result

```text
01052026 - Das ist ein.mp4
```

---

## 12. Generic Placeholder Example

The same filename can also be parsed using arbitrary placeholder names.

### 12.1 Existing filename

```text
2026-05-01 - Das ist ein - Test.mp4
```

### 12.2 Input schema

```text
%a-%b-%c - %whatever - %x.mp4
```

### 12.3 Captured values

```text
%a        = 2026
%b        = 05
%c        = 01
%whatever = Das ist ein
%x        = Test
```

### 12.4 Output schema

```text
%c%b%a - %whatever.mp4
```

### 12.5 Result

```text
01052026 - Das ist ein.mp4
```

The app does not care what these placeholders mean.

They are user-defined capture groups.

---

## 13. Placeholder Syntax

### 13.1 Recommended syntax

Placeholders begin with `%`.

Recommended valid placeholder format:

```regex
%[A-Za-z][A-Za-z0-9_]*
```

### 13.2 Valid examples

```text
%a
%b
%x
%title
%date
%episode_2
%myCustomThing
```

### 13.3 Invalid examples

```text
%
%1
%-
% title
```

### 13.4 Escaping literal percent signs

To use a literal percent sign in a schema:

```text
%%
```

Example schema:

```text
%title %% complete.mp4
```

Could match filename:

```text
Project 50 % complete.mp4
```

---

## 14. System Variables

User-defined placeholders use `%`.

System variables should use `@`.

This avoids conflicts with user-defined placeholders.

Recommended system variables:

```text
@ext        Original extension without dot
@filename   Original full filename
@basename   Original filename without extension
@n          Conflict counter, only available when conflict numbering is enabled
```

Important:

```text
%ext should not be reserved.
```

A user might want to use `%ext` for their own meaning.

Therefore, built-in variables should use the `@` namespace.

---

## 15. Extension Handling

The app should support two modes.

### 15.1 Full filename mode

The input schema includes the extension.

Example:

```text
%a-%b-%c - %title.mp4
```

In this mode, `.mp4` is treated as literal text.

### 15.2 Preserve extension mode

The input schema applies only to the filename without the extension.

Example filename:

```text
2026-05-01 - Das ist ein - Test.mp4
```

Input schema:

```text
%a-%b-%c - %title - %suffix
```

Output schema:

```text
%c%b%a - %title.@ext
```

Result:

```text
01052026 - Das ist ein.mp4
```

### 15.3 Recommended v1 default

Use preserve extension mode by default.

Reason:

```text
It prevents accidental extension loss
It allows one schema to work across several file extensions
It is easier for non-technical users
```

Full filename mode should be available as an advanced option.

---

## 16. Schema Token Model

Internally, both input and output schemas should be parsed into tokens.

### 16.1 Token types

```js
/**
 * @typedef {Object} LiteralToken
 * @property {"literal"} type
 * @property {string} value
 */

/**
 * @typedef {Object} PlaceholderToken
 * @property {"placeholder"} type
 * @property {string} name
 */

/**
 * @typedef {Object} SystemVariableToken
 * @property {"systemVariable"} type
 * @property {string} name
 */

/**
 * @typedef {LiteralToken | PlaceholderToken | SystemVariableToken} SchemaToken
 */
```

### 16.2 Example input schema

```text
%a-%b-%c - %title - %suffix
```

### 16.3 Tokenized form

```json
[
  { "type": "placeholder", "name": "a" },
  { "type": "literal", "value": "-" },
  { "type": "placeholder", "name": "b" },
  { "type": "literal", "value": "-" },
  { "type": "placeholder", "name": "c" },
  { "type": "literal", "value": " - " },
  { "type": "placeholder", "name": "title" },
  { "type": "literal", "value": " - " },
  { "type": "placeholder", "name": "suffix" }
]
```

---

## 17. Filename Matching Logic

The matcher applies the input schema to a filename.

### 17.1 Basic behavior

Input filename:

```text
2026-05-01 - Das ist ein - Test
```

Input schema:

```text
%a-%b-%c - %title - %suffix
```

Result:

```text
%a      = 2026
%b      = 05
%c      = 01
%title  = Das ist ein
%suffix = Test
```

### 17.2 Literal separators

Literal text in the schema acts as an anchor.

In this schema:

```text
%a-%b-%c - %title - %suffix
```

The literals are:

```text
-
-
 - 
 - 
```

The matcher should use these literals to determine where placeholders start and stop.

### 17.3 Non-greedy matching

Placeholder matching should be non-greedy where possible.

Example schema:

```text
%a - %b - %c
```

Filename:

```text
One - Two - Three
```

Expected result:

```text
%a = One
%b = Two
%c = Three
```

### 17.4 Adjacent placeholders

Adjacent placeholders are ambiguous.

Example:

```text
%a%b
```

Filename:

```text
abcdef
```

There is no obvious way to know where `%a` ends and `%b` begins.

Recommended v1 behavior:

```text
Block adjacent placeholders.
```

Future enhancement:

```text
%a{4}%b{2}
```

Could mean:

```text
%a captures exactly 4 characters
%b captures exactly 2 characters
```

### 17.5 Repeated placeholders

Example schema:

```text
%name - %title - %name
```

Filename:

```text
Alice - Example - Alice
```

This should match.

Filename:

```text
Alice - Example - Bob
```

This should not match, because `%name` captures different values.

Recommended behavior:

```text
Allow repeated placeholders.
Require repeated captures to be identical.
If they are not identical, mark file as not matched.
```

---

## 18. Output Rendering Logic

The output renderer creates target filenames from captured values.

### 18.1 Example

Captured values:

```text
%a = 2026
%b = 05
%c = 01
%title = Das ist ein
@ext = mp4
```

Output schema:

```text
%c%b%a - %title.@ext
```

Result:

```text
01052026 - Das ist ein.mp4
```

### 18.2 Undefined placeholders

If the output schema references a placeholder not present in the input schema, validation must fail.

Example input schema:

```text
%a-%b-%c - %title
```

Output schema:

```text
%c%b%a - %artist.@ext
```

Error:

```text
Output schema uses unknown placeholder: %artist
```

### 18.3 Empty output

If the rendered filename is empty, the file must be marked invalid.

### 18.4 Invalid filename characters

The app should validate output filenames.

For cross-platform safety, block or warn about characters that are invalid on common filesystems.

Recommended cross-platform invalid characters:

```text
< > : " / \ | ? *
```

Also handle:

```text
Trailing spaces
Trailing dots
Control characters
Reserved Windows names such as CON, PRN, AUX, NUL, COM1, LPT1
Very long filenames
```

### 18.5 Filename validation modes

Recommended options:

```text
Strict:
Block invalid filenames.

Clean:
Automatically replace invalid characters.

Cross-platform safe:
Use stricter Windows-compatible validation even on macOS and Linux.
```

Recommended v1 default:

```text
Strict preview validation.
```

Clean mode can be added later.

---

## 19. Conflict Handling

### 19.1 Conflict types

The app must detect:

```text
Two selected files produce the same output name
Output file already exists in the selected file list
Output name equals another file’s current name
Source-target swap conflict
Case-only rename conflict on case-insensitive filesystems
Output name is invalid
Output name is empty
Output name is too long
Output would overwrite a non-selected file known to the browser file list
```

Important limitation:

```text
The browser only knows about files selected through the folder picker.
```

If the browser selection does not include hidden files or excluded files, the generated script should still revalidate before applying.

### 19.2 Conflict behavior options

Recommended v1 options:

```text
Block
Auto-number
```

Recommended later options:

```text
Auto-number with custom pattern
Add conflict counter using @n
Skip conflicting files
Keep original filename on conflict
```

### 19.3 Default behavior

Default:

```text
Block
```

Reason:

```text
The safest default is to prevent accidental destructive rename plans.
```

### 19.4 Auto-numbering example

If multiple files produce:

```text
Example.mp4
```

Auto-numbering could produce:

```text
Example.mp4
Example (2).mp4
Example (3).mp4
```

### 19.5 Conflict counter

If the app supports `@n`, then an output schema could be:

```text
%title - @n.@ext
```

But `@n` should only be valid when conflict numbering is enabled.

---

## 20. Generated Script Safety Model

The generated script is the only component that can actually rename files.

Therefore, the script must be extremely conservative.

### 20.1 Mandatory dry-run default

The generated script must always run in dry-run mode unless `--force` is provided.

Required behavior:

```bash
bash rename.sh
```

Shows planned renames only.

```bash
bash rename.sh --force
```

Actually renames files.

No other option should perform real renames.

### 20.2 Explicit force flag

The only apply mode should be:

```bash
--force
```

Recommended script behavior:

```text
No --force:
  Print all planned renames
  Validate as much as possible
  Do not mutate files
  Exit successfully if plan is valid

With --force:
  Validate sources and targets again
  Use temporary rename strategy
  Apply renames
  Print results
```

### 20.3 No silent overwrite

The script must never silently overwrite files.

Before applying, it must check:

```text
Every source file exists
Every target file does not already exist, unless source and target are the same file
No target path is empty
No duplicate target path exists in the plan
No temporary filename already exists
```

### 20.4 Temporary rename strategy

To avoid collisions, the script should not directly rename old names to final names in one pass.

Example problem:

```text
A.mp4 → B.mp4
B.mp4 → A.mp4
```

Naive renaming can fail.

Recommended strategy:

```text
1. Validate all selected rename pairs.
2. Rename every source file to a unique temporary name.
3. Rename every temporary file to its final target name.
```

### 20.5 Script output

Dry-run output should be readable and explicit.

Example:

```text
Schema Rename Script
Mode: DRY RUN

Planned renames:

[READY] 2026-05-01 - Das ist ein - Test.mp4
   --> 01052026 - Das ist ein.mp4

No files were renamed.
Run with --force to apply these changes.
```

Force output should be explicit:

```text
Schema Rename Script
Mode: FORCE

Validating...
Applying temporary renames...
Applying final renames...
Done.
```

---

## 21. Bash/Zsh Compatibility

The generated script should be Bash-compatible.

Recommended shebang:

```bash
#!/usr/bin/env bash
```

The script can be executed from Zsh by calling Bash explicitly:

```zsh
bash rename.sh
bash rename.sh --force
```

Do not generate Zsh-specific syntax unless a separate Zsh mode is added later.

---

## 22. Shell Quoting

Every filename must be safely shell-quoted.

Do not generate unsafe commands like:

```bash
mv old name.mp4 new name.mp4
```

Generated commands must handle:

```text
Spaces
Quotes
Parentheses
Ampersands
Unicode characters
Leading dashes
Other shell-sensitive characters
```

A JavaScript shell-quote helper:

```js
function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}
```

Example:

```text
John's File.mp4
```

Becomes:

```bash
'John'\''s File.mp4'
```

Use:

```bash
mv -- "$old" "$new"
```

or generate shell-quoted literals carefully.

The `--` is important because filenames can start with `-`.

---

## 23. Recommended Generated Script Structure

The generated script should use explicit arrays or a safely encoded data section.

Recommended simple and robust approach for v1:

```bash
#!/usr/bin/env bash
set -euo pipefail

FORCE=false

if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
elif [[ "${1:-}" != "" ]]; then
  echo "Unknown option: ${1:-}" >&2
  echo "Usage: bash rename.sh [--force]" >&2
  exit 2
fi

echo "Schema Rename Script"
if [[ "$FORCE" == true ]]; then
  echo "Mode: FORCE"
else
  echo "Mode: DRY RUN"
fi
echo

OLD_NAMES=(
  '2026-05-01 - Das ist ein - Test.mp4'
)

NEW_NAMES=(
  '01052026 - Das ist ein.mp4'
)

COUNT="${#OLD_NAMES[@]}"

echo "Planned renames:"
echo

for ((i = 0; i < COUNT; i++)); do
  echo "[$((i + 1))/$COUNT] ${OLD_NAMES[$i]}"
  echo "    --> ${NEW_NAMES[$i]}"
done

echo

if [[ "$FORCE" != true ]]; then
  echo "No files were renamed."
  echo "Run with --force to apply these changes:"
  echo "  bash rename.sh --force"
  exit 0
fi

echo "Validating..."

for ((i = 0; i < COUNT; i++)); do
  old="${OLD_NAMES[$i]}"
  new="${NEW_NAMES[$i]}"

  if [[ ! -e "$old" ]]; then
    echo "Missing source: $old" >&2
    exit 1
  fi

  if [[ "$old" != "$new" && -e "$new" ]]; then
    echo "Target already exists: $new" >&2
    exit 1
  fi
done

echo "Preparing temporary names..."

TMP_NAMES=()

for ((i = 0; i < COUNT; i++)); do
  tmp=".rename_tmp_${i}_$(date +%s)_$RANDOM"

  if [[ -e "$tmp" ]]; then
    echo "Temporary file already exists: $tmp" >&2
    exit 1
  fi

  TMP_NAMES+=("$tmp")
done

echo "Applying temporary renames..."

for ((i = 0; i < COUNT; i++)); do
  old="${OLD_NAMES[$i]}"
  tmp="${TMP_NAMES[$i]}"

  if [[ "$old" != "${NEW_NAMES[$i]}" ]]; then
    mv -- "$old" "$tmp"
  fi
done

echo "Applying final renames..."

for ((i = 0; i < COUNT; i++)); do
  old="${OLD_NAMES[$i]}"
  new="${NEW_NAMES[$i]}"
  tmp="${TMP_NAMES[$i]}"

  if [[ "$old" != "$new" ]]; then
    mv -- "$tmp" "$new"
  fi
done

echo "Done."
```

Important improvement for production:

```text
Generate TMP_NAMES deterministically before any rename.
Make temporary names include a unique script run identifier.
Handle skipped no-op renames carefully.
Optionally write a local operation log.
```

---

## 24. Script Generation Data Model

### 24.1 File entry

```js
/**
 * @typedef {Object} FileEntry
 * @property {string} id
 * @property {string} name
 * @property {string} relativePath
 * @property {string} basename
 * @property {string|null} extension
 * @property {number} sizeBytes
 * @property {number} lastModified
 * @property {boolean} selected
 */
```

### 24.2 Preview request

```js
/**
 * @typedef {Object} PreviewRequest
 * @property {FileEntry[]} files
 * @property {string} inputSchema
 * @property {string} outputSchema
 * @property {"preserve"|"fullFilename"} extensionMode
 * @property {"sensitive"|"insensitive"} caseSensitivity
 * @property {"block"|"autoNumber"} conflictBehavior
 * @property {"strict"|"clean"|"crossPlatformSafe"} filenameValidationMode
 */
```

### 24.3 Rename plan

```js
/**
 * @typedef {Object} RenamePlan
 * @property {string} createdAt
 * @property {string} inputSchema
 * @property {string} outputSchema
 * @property {RenamePlanItem[]} items
 * @property {RenameValidationSummary} validation
 */
```

### 24.4 Rename plan item

```js
/**
 * @typedef {Object} RenamePlanItem
 * @property {string} id
 * @property {boolean} selected
 * @property {string} sourceName
 * @property {string} sourceRelativePath
 * @property {string|null} targetName
 * @property {string|null} targetRelativePath
 * @property {boolean} matched
 * @property {Object.<string, string>} captures
 * @property {Object.<string, string>} systemVariables
 * @property {RenameStatus} status
 * @property {string[]} warnings
 * @property {string[]} errors
 */
```

### 24.5 Rename status

```js
/**
 * @typedef {
 *   "ready" |
 *   "notMatched" |
 *   "conflict" |
 *   "invalidOutput" |
 *   "wouldOverwrite" |
 *   "skipped"
 * } RenameStatus
 */
```

### 24.6 Validation summary

```js
/**
 * @typedef {Object} RenameValidationSummary
 * @property {number} totalFiles
 * @property {number} matchedFiles
 * @property {number} unmatchedFiles
 * @property {number} readyFiles
 * @property {number} conflictedFiles
 * @property {number} invalidFiles
 * @property {number} selectedFiles
 * @property {boolean} canGenerateScript
 */
```

---

## 25. UI Design

### 25.1 Main layout

```text
┌────────────────────────────────────────────────────────────┐
│ Schema Rename Script Generator                             │
├────────────────────────────────────────────────────────────┤
│ Folder                                                     │
│ [Choose Folder]                                            │
│ 142 files loaded                                           │
├────────────────────────────────────────────────────────────┤
│ Input Schema                                               │
│ [%a-%b-%c - %title - %suffix]                              │
│ Extension handling: [Preserve extension v]                 │
│                                                            │
│ Example file                                               │
│ 2026-05-01 - Das ist ein - Test.mp4                        │
│                                                            │
│ Captured placeholders                                      │
│ %a       2026                                              │
│ %b       05                                                │
│ %c       01                                                │
│ %title   Das ist ein                                       │
│ %suffix  Test                                              │
├────────────────────────────────────────────────────────────┤
│ Output Schema                                              │
│ [%c%b%a - %title.@ext]                                     │
│ Conflict behavior: [Block v]                               │
├────────────────────────────────────────────────────────────┤
│ Preview                                                    │
│ [x] Old name                         New name      Status  │
│ [x] 2026-05-01 - Das...mp4           01052026...   Ready   │
│ [ ] foo.mp4                          —             No match│
├────────────────────────────────────────────────────────────┤
│ Script                                                     │
│ [Copy script] [Download rename.sh]                         │
│                                                            │
│ The script runs as dry-run by default.                     │
│ Use --force to actually rename files.                      │
└────────────────────────────────────────────────────────────┘
```

### 25.2 Preview table columns

Recommended columns:

```text
Selected
Status
Old filename
New filename
Captured values
Warnings
Errors
```

Optional advanced columns:

```text
Extension
File size
Modified date
Conflict group
Relative path
```

### 25.3 Row statuses

```text
Ready
Not matched
Output error
Duplicate output
Would overwrite existing file
Selected
Skipped
```

### 25.4 UX principles

```text
Preview-first
Dry-run-first
No direct browser filesystem mutation
Clear status language
No generated script if plan has blocking errors
Beginner-friendly defaults
Advanced options collapsed
Inline examples
Auditable script output
```

---

## 26. Script UI

The app should provide:

```text
Generate script
Copy script
Download rename.sh
Show script preview
```

The script preview should include a warning:

```text
This script does not rename files unless run with --force.
Run it once without --force first and review the output.
```

Recommended instructions shown in UI:

```bash
cd "/path/to/your/folder"
bash rename.sh
bash rename.sh --force
```

---

## 27. Script Download

The app can generate a downloadable file using a browser Blob.

Example:

```js
function downloadTextFile(filename, content) {
  const blob = new Blob([content], {
    type: "text/x-shellscript;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
```

---

## 28. Implementation Modules

For a simple vanilla JavaScript implementation, split logic into conceptual modules.

Even if kept in one `app.js`, keep these sections separated.

### 28.1 UI module

Responsible for:

```text
Folder input
Schema inputs
Preview table rendering
Warnings and errors
Button states
Script preview
Copy/download actions
```

### 28.2 Schema parser

Responsible for:

```text
Tokenizing input and output schemas
Validating placeholder syntax
Validating system variables
Handling escaped percent signs
Detecting adjacent placeholders
```

### 28.3 Filename matcher

Responsible for:

```text
Applying input schema to filenames
Capturing placeholder values
Handling repeated placeholders
Supporting extension modes
Returning match results
```

### 28.4 Output renderer

Responsible for:

```text
Rendering target filenames
Using captured placeholders
Using system variables
Validating undefined placeholders
Validating empty outputs
```

### 28.5 Conflict detector

Responsible for:

```text
Duplicate target detection
Existing filename collision detection
Case-insensitive conflict detection
Source-target swap detection
Auto-numbering if enabled
```

### 28.6 Script generator

Responsible for:

```text
Generating Bash-compatible script
Escaping all filenames
Embedding selected rename pairs
Generating dry-run default behavior
Enabling actual rename only with --force
Using temporary rename strategy
Adding validation checks
```

---

## 29. Implementation Phases

## Phase 0 — Product Decisions

Decide:

```text
App name
Placeholder syntax
System variable syntax
Extension handling default
Recursive folder support
Subfolder output support
Conflict behavior for v1
Filename validation behavior
Script style
```

Recommended v1 decisions:

```text
App type: static web app
Language: HTML, CSS, vanilla JavaScript
UI language: English only
Localization-ready: yes
Custom placeholders: yes
System variables: @ prefix
Recursive folders: no
Subfolder output: no
Extension handling: preserve extension by default
Conflict behavior: block by default, optional auto-number
Script behavior: dry-run by default, real rename only with --force
```

---

## Phase 1 — Static App Skeleton

Tasks:

```text
Create index.html
Create style.css
Create app.js
Create basic layout
Add folder picker
Add placeholder schema fields
Add preview table placeholder
Add script output placeholder
Add README.md
Add CHANGELOG.md
```

Acceptance criteria:

```text
App opens in browser
User can see complete basic UI
No parsing logic yet
No generated script yet
```

---

## Phase 2 — Folder Loading

Tasks:

```text
Implement webkitdirectory file input
Read selected files
Store file entries
Extract name, relativePath, basename, extension, size, modified date
Display file count
Display files in preview table
```

Acceptance criteria:

```text
User can select folder
App lists files
Relative paths are available
Directories are ignored
```

---

## Phase 3 — Schema Parser

Tasks:

```text
Implement schema tokenizer
Support literal tokens
Support user-defined placeholders
Support system variables
Support escaped percent sign %%
Validate placeholder syntax
Validate system variable syntax
Block adjacent placeholders
Return helpful errors
```

Acceptance criteria:

```text
Input and output schemas are tokenized
Invalid schemas show useful messages
Escaped percent signs work
Adjacent placeholders are blocked
```

---

## Phase 4 — Filename Matcher

Tasks:

```text
Apply input schema to filenames
Support preserve extension mode
Support full filename mode
Extract captured values
Validate repeated placeholders
Return notMatched status when needed
```

Acceptance criteria:

```text
Filename "2026-05-01 - Das ist ein - Test.mp4"
Input schema "%a-%b-%c - %title - %suffix"
Preserve extension mode
Extracts:
a=2026
b=05
c=01
title=Das ist ein
suffix=Test
@ext=mp4
```

---

## Phase 5 — Output Renderer

Tasks:

```text
Parse output schema
Validate output placeholders against input placeholders
Render target filenames
Support @ext, @basename, @filename
Validate invalid filenames
Detect empty output
```

Acceptance criteria:

```text
Output schema renders target filename
Unknown placeholders block preview
Invalid target filenames are marked
```

---

## Phase 6 — Rename Plan and Preview

Tasks:

```text
Generate rename plan
Mark ready files
Mark unmatched files
Mark invalid files
Mark conflicts
Render preview table
Support selected/unselected rows
Show summary footer
```

Acceptance criteria:

```text
Preview shows old filename, new filename, status, and captures
Changing schemas updates preview
Only selected ready files are included in script generation
```

---

## Phase 7 — Conflict Detection

Tasks:

```text
Detect duplicate target names
Detect target names already present in loaded file list
Detect case-only conflicts
Detect swap conflicts
Implement block mode
Implement auto-number mode
```

Acceptance criteria:

```text
Conflicts are visible
Script generation is blocked for invalid plans
Auto-number can create unique target names
```

---

## Phase 8 — Script Generator

Tasks:

```text
Generate Bash-compatible script
Dry-run by default
Use --force for real renames
Safely quote filenames
Use relative paths
Include validation
Use temporary rename strategy
Print clear output
Generate copyable script
Generate downloadable rename.sh
```

Acceptance criteria:

```text
Running bash rename.sh only prints the plan
Running bash rename.sh --force applies the renames
Script checks sources and targets before applying
Script does not overwrite existing files silently
Script works with spaces and quotes in filenames
```

---

## Phase 9 — Documentation

Tasks:

```text
Complete README.md
Create SCHEMA.md
Create SAFETY.md
Create LOCALIZATION.md
Create VERSIONING.md
Maintain CHANGELOG.md
Add example workflows
Add terminal instructions
Document --force behavior clearly
```

Acceptance criteria:

```text
A user understands how to use the app
A developer understands the architecture
The dry-run-first safety model is clearly documented
```

---

## Phase 10 — Localization Readiness

Even if v1 is English-only, prepare the app for localization.

Tasks:

```text
Use an i18n dictionary object for visible strings
Avoid hardcoded UI text where practical
Create English string dictionary
Document how to add more languages
```

Example:

```js
const STRINGS = {
  "app.title": "Schema Rename Script Generator",
  "folder.choose": "Choose folder",
  "schema.input.title": "Input schema",
  "schema.output.title": "Output schema",
  "preview.status.ready": "Ready",
  "preview.status.notMatched": "Not matched",
  "preview.status.conflict": "Conflict",
  "script.copy": "Copy script",
  "script.download": "Download rename.sh",
  "script.forceNotice": "The script runs as dry-run by default. Use --force to actually rename files."
};
```

---

## 30. Versioning Plan

Use Semantic Versioning.

### 30.1 Suggested development versions

```text
0.1.0
Initial static UI prototype

0.2.0
Folder loading and file preview

0.3.0
Schema parsing and capture preview

0.4.0
Output rendering and rename preview

0.5.0
Conflict detection

0.6.0
Script generation with dry-run default and --force apply mode

0.7.0
UI polish and documentation

1.0.0
First stable release
```

### 30.2 Versioning rules

```text
MAJOR version:
Breaking schema behavior or generated script compatibility

MINOR version:
New features, new conflict modes, new system variables

PATCH version:
Bug fixes, UI corrections, documentation corrections, localization fixes
```

---

## 31. Changelog Tracking

Use `CHANGELOG.md`.

Recommended structure:

```markdown
# Changelog

## [Unreleased]

### Added
- Initial schema parser.
- Folder file-list preview.
- Script generation with dry-run default.

### Changed
- Improved rename preview table layout.

### Fixed
- Fixed handling of escaped percent signs in schemas.

## [0.1.0] - 2026-05-12

### Added
- Initial static web app skeleton.
```

Recommended categories:

```text
Added
Changed
Deprecated
Removed
Fixed
Security
```

---

## 32. Documentation Files

### 32.1 README.md

Should contain:

```text
What the app does
How to open the app
How to select a folder
How to define schemas
How to preview renames
How to generate the script
How to run dry-run
How to run with --force
Safety notes
Development setup
```

### 32.2 SCHEMA.md

Should contain:

```text
Input schema syntax
Output schema syntax
User-defined placeholders
Escaping
System variables
Extension handling
Examples
Known limitations
```

### 32.3 SAFETY.md

Should contain:

```text
Browser does not rename directly
Generated script dry-runs by default
--force is required for real renames
No silent overwrite
Conflict detection
Temporary rename strategy
Shell quoting
Known browser limitations
```

### 32.4 LOCALIZATION.md

Should contain:

```text
Current language: English
How UI strings are stored
How to add a language
Placeholder naming guidance
Translation review process
```

### 32.5 VERSIONING.md

Should contain:

```text
Semantic versioning rules
Pre-1.0 expectations
Breaking change rules
Schema compatibility rules
Script compatibility rules
```

---

## 33. Suggested Codex Prompt

Use this as the first implementation prompt in Codex:

```text
We are building a static browser-only batch rename script generator using HTML, CSS, and vanilla JavaScript.

The app must not rename files directly.

It should let the user select a local folder using a browser file input with webkitdirectory, define an input schema, preview captured placeholders, define an output schema, preview old-to-new filenames, detect conflicts, and generate a Bash-compatible rename script.

Important behavior:
- Placeholder names are fully user-defined.
- The app must not attach semantic meaning to names like %y, %m, %d, or %title.
- Any placeholder declared in the input schema becomes available in the output schema.
- The output schema must fail validation if it references a placeholder not present in the input schema.
- Built-in/system variables must use @name, not %name, to avoid conflicts with user-defined placeholders.
- Suggested system variables:
  - @ext: original extension without dot
  - @basename: original filename without extension
  - @filename: original full filename
  - @n: conflict counter, only available during conflict resolution
- Preserve extension mode should be the default.
- Adjacent placeholders like %a%b should be blocked in v1.
- The generated script must always dry-run by default.
- The generated script must only perform actual renames when called with --force.
- The generated script must use safe shell quoting.
- The generated script must validate sources and targets before applying.
- The generated script must never overwrite files silently.
- The generated script must use a temporary rename strategy to avoid swap conflicts.
- The app should be English-only for v1 but localization-ready.

Please create:
1. index.html
2. style.css
3. app.js
4. README.md
5. CHANGELOG.md
6. SCHEMA.md
7. SAFETY.md
8. LOCALIZATION.md
9. VERSIONING.md

Implement the first vertical slice:
- Folder selection
- File list preview
- Input schema field
- Output schema field
- Basic schema tokenizer
- Basic filename matching
- Basic output rendering
- Preview table
- Script generation
- Download rename.sh
- Copy script button

Do not use a backend.
Do not use Tauri.
Do not use Electron.
Do not use filesystem write APIs.
```

---

## 34. Design Questions Still To Decide

### 34.1 App name

Possible names:

```text
Rename Script Studio
Schema Rename
NameForge
File Loom
Batchsmith
PatternRename
Nameweaver
Rename Plan
```

### 34.2 Placeholder syntax

Should placeholders allow only letters, numbers, and underscores?

Recommended:

```text
Yes.
```

Reason:

```text
Predictable parsing
Easy validation
Good compatibility with future transformations
```

### 34.3 System variable prefix

Should system variables use `@`?

Recommended:

```text
Yes.
```

Reason:

```text
Keeps all % placeholders user-defined
Avoids conflicts with names like %ext
```

### 34.4 Extension handling

Should v1 default to preserving extension?

Recommended:

```text
Yes.
```

Reason:

```text
Safer and easier for users
```

### 34.5 Recursive folders

Should v1 include recursive folder support?

Recommended:

```text
No.
```

Reason:

```text
Recursive renaming increases risk and UI complexity.
```

However, because `webkitdirectory` can expose relative paths, recursive support may become possible later.

### 34.6 Subfolder output

Should output schemas be allowed to create folders?

Example:

```text
%a/%b/%title.@ext
```

Recommended v1:

```text
No.
```

Reason:

```text
Renaming and moving files should be separate concepts at first.
```

### 34.7 Script apply flag

Should the force flag be called `--force`?

Required decision:

```text
Yes.
```

The script must dry-run unless `--force` is provided.

### 34.8 Presets

Should the app include schema presets?

Recommended:

```text
Yes, but not required for the first technical prototype.
```

Potential presets:

```text
Date Title Suffix:
Input:  %a-%b-%c - %title - %suffix
Output: %c%b%a - %title.@ext

Simple Title Suffix:
Input:  %title - %suffix
Output: %title.@ext

Three-Part Name:
Input:  %a - %b - %c
Output: %c - %a - %b.@ext
```

---

## 35. MVP Definition

The first usable MVP should include:

```text
Static web app
Folder selection
File list preview
Define input schema
Preview captured placeholders
Define output schema
Preview new filenames
Detect unmatched files
Detect duplicate output names
Select files
Generate Bash-compatible script
Script dry-runs by default
Script renames only with --force
Download rename.sh
Copy script
English-only UI
Localization-ready string structure
```

Not included in MVP:

```text
Direct browser renaming
Tauri
Electron
Backend
Recursive folder rename
Subfolder output
Advanced transformations
One-click undo
Preset marketplace
Cloud sync
Rules library
File metadata extraction
Regex expert mode
Fixed-width placeholder syntax
```

---

## 36. Future Feature Ideas

```text
Regex expert mode
Saved schema presets
Drag-and-drop folder selection
Recursive mode
Subfolder creation
Generated undo script
Filename transformations: trim, upper, lower, titlecase
Fixed-width placeholders
Optional placeholder constraints
Date validation
Media metadata variables
CSV import/export
Before/after diff export
Dry-run report as Markdown or CSV
Preset sharing
Localized UI: German, Japanese, French, Spanish
Dark mode
Client-side project save/load as JSON
```

---

## 37. Main Risk Areas

### 37.1 Ambiguous parsing

Input schemas with adjacent placeholders are dangerous:

```text
%a%b
```

There is no clear separator.

Recommended v1 behavior:

```text
Block adjacent placeholders.
```

### 37.2 Browser path limitations

Browsers generally do not expose the absolute local folder path.

Recommended behavior:

```text
Generate relative-path scripts.
Tell the user to run the script from the target folder.
```

### 37.3 Shell escaping

Filenames can contain spaces, quotes, Unicode, and leading dashes.

Recommended behavior:

```text
Always shell-quote generated filename literals.
Use mv --.
Test filenames with spaces and single quotes.
```

### 37.4 Accidental destructive renames

Batch rename scripts can cause damage quickly.

Recommended behavior:

```text
Dry-run by default
Require --force
No silent overwrite
Temporary rename strategy
Clear terminal output
Generated script is human-readable
```

### 37.5 Filesystem differences

Windows, macOS, and Linux differ in filename rules and case sensitivity.

Recommended behavior:

```text
Use strict validation by default.
Offer cross-platform-safe validation.
Clearly show invalid target names.
```

### 37.6 UX complexity

The app can become too technical.

Recommended behavior:

```text
Beginner-friendly defaults
Advanced options collapsed
Live examples
Clear row statuses
Preset schemas later
Readable generated script
```

---

## 38. Recommended Implementation Order

Recommended order:

```text
1. Static UI skeleton
2. Folder file loading
3. Schema tokenizer
4. Filename matcher
5. Output renderer
6. Rename plan generator
7. Conflict detector
8. Script generator
9. Copy/download script
10. Documentation
11. UI polish
12. Localization readiness
```

---

## 39. Final Safety Rule

The generated script must never rename files unless this exact user action happens:

```bash
bash rename.sh --force
```

or:

```bash
./rename.sh --force
```

Every other invocation must behave as a dry run.

This is the most important safety behavior in the entire product.
