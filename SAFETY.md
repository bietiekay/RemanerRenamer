# Safety Model

RemanerRenamer is a rename-plan generator, not a direct renaming tool.

## Browser Safety

The app reads filenames through the browser folder picker. It does not request
filesystem write access and does not rename files directly.

No file contents or rename data are uploaded to a server, processed remotely, or
stored on a server. The app handles filenames locally in the browser.

The browser usually does not expose the selected folder's absolute path, so the
generated script uses relative filenames and assumes it is run from the target
folder.

## Script Safety

The generated script always dry-runs unless `--force` is passed.

```bash
bash rename.sh
```

prints the plan and renames nothing.

```bash
bash rename.sh --force
```

validates the plan again and applies it.

## Validation

Before applying, the script checks:

- sources exist
- source and target names are not empty
- targets are unique
- existing targets are not overwritten unless they are selected moving sources
- target folders are valid relative paths
- existing target parents are directories
- temporary names are available

The app also blocks unsafe output names with strict cross-platform filename
validation.

## Replacements

Replacement rules are applied in the browser after output rendering and before
target validation. The preview, conflict detector, and generated script all use
the final replaced paths.

Rules run on each path segment separately, so replacement text containing `/` is
blocked. This keeps folder structure controlled by the output schema.

## Folder Creation

When an output schema contains `/`, the rendered target becomes a relative path.
The script creates missing target folders with `mkdir -p` only in `--force`
mode, after validation and before file moves.

Absolute paths, empty folder segments, `.` segments, and `..` segments are
blocked.

## Temporary Rename Strategy

The script first renames moving sources to temporary names, then renames those
temporary files to final targets. This supports safe swaps such as:

```text
A.mp4 -> B.mp4
B.mp4 -> A.mp4
```

## Known Limits

The app only knows about files exposed by the browser picker. Hidden files or
files outside the selected browser list may still exist in the folder, so the
script revalidates before applying.
