# RemanerRenamer

RemanerRenamer is a static browser app for building safe batch rename plans.
It does not rename files in the browser. It previews filename mappings and
generates a Bash script that dry-runs by default.

## Use

Open `index.html` in a modern browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

1. Choose a folder.
2. Enter an input schema for current filenames.
3. Review captured placeholders.
4. Enter an output schema for new filenames.
5. Review the preview table and deselect files that should not be included.
6. Generate, copy, or download `rename.sh`.
7. Run the script once without `--force`.
8. Run it again with `--force` only after reviewing the dry run.

```bash
cd "/path/to/your/folder"
bash rename.sh
bash rename.sh --force
```

## Example

Filename:

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

Output schemas can also include folders. A `/` separator makes the generated
script place the file in a relative folder path and create folders as needed
when run with `--force`:

```text
%a/%c%b%a/%title.@ext
```

Result:

```text
2026/01052026/Das ist ein.mp4
```

## Development

No build step or package install is required.

Run the logic tests with:

```bash
node tests/logic.test.js
```

## Safety

- The browser app never writes to the filesystem.
- The generated script validates sources and targets before applying.
- The generated script creates target folders when output schemas contain `/`.
- The generated script does not silently overwrite targets.
- Real renames happen only with `--force`.

See `SCHEMA.md` and `SAFETY.md` for details.
