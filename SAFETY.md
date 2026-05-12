# Safety Model

RemanerRenamer is a rename-plan generator, not a direct renaming tool.

## Browser Safety

The app reads filenames through the browser folder picker. It does not request
filesystem write access and does not rename files directly.

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
- temporary names are available

The app also blocks unsafe output names with strict cross-platform filename
validation.

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
