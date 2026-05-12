(function attachRemanerRenamer(root) {
  "use strict";

  const STRINGS = {
    "app.title": "Schema Rename Script Generator",
    "folder.title": "Folder",
    "folder.choose": "Choose folder",
    "schema.input.title": "Input schema",
    "schema.input.label": "Existing filename pattern",
    "schema.output.title": "Output schema",
    "schema.output.label": "New filename pattern",
    "schema.extensionMode": "Extension mode",
    "schema.caseSensitivity": "Filesystem case",
    "capture.title": "Captured placeholders",
    "script.title": "Script",
    "preview.title": "Preview"
  };

  const DEFAULT_INPUT_SCHEMA = "%a-%b-%c - %title - %suffix";
  const DEFAULT_OUTPUT_SCHEMA = "%c%b%a - %title.@ext";
  const SUPPORTED_SYSTEM_VARIABLES = new Set(["ext", "basename", "filename"]);
  const RESERVED_SYSTEM_VARIABLES = new Set(["n"]);
  const INVALID_PATH_SEGMENT_CHARS = /[<>:"\\|?*\u0000-\u001f]/;
  const WINDOWS_RESERVED_NAMES = new Set([
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9"
  ]);

  const STATUS_LABELS = {
    ready: "Ready",
    notMatched: "Not matched",
    conflict: "Conflict",
    invalidOutput: "Output error",
    wouldOverwrite: "Would overwrite",
    skipped: "Skipped"
  };

  function uniqueArray(values) {
    return Array.from(new Set(values));
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }

  function splitExtension(name) {
    const lastDot = name.lastIndexOf(".");
    if (lastDot > 0 && lastDot < name.length - 1) {
      return {
        basename: name.slice(0, lastDot),
        extension: name.slice(lastDot + 1)
      };
    }
    return { basename: name, extension: "" };
  }

  function makeFileId(relativePath, index) {
    return `${index}:${relativePath}`;
  }

  function isNestedRelativePath(relativePath) {
    const parts = String(relativePath || "").split("/").filter(Boolean);
    return parts.length > 2;
  }

  function createFileEntryFromName(name, options = {}) {
    const parts = splitExtension(name);
    const index = options.index || 0;
    const relativePath = options.relativePath || name;
    return {
      id: options.id || makeFileId(relativePath, index),
      name,
      relativePath,
      basename: parts.basename,
      extension: parts.extension,
      sizeBytes: options.sizeBytes || 0,
      lastModified: options.lastModified || 0,
      selected: options.selected !== false
    };
  }

  function createFileEntryFromBrowserFile(file, index) {
    const relativePath = file.webkitRelativePath || file.name;
    return createFileEntryFromName(file.name, {
      index,
      relativePath,
      sizeBytes: file.size,
      lastModified: file.lastModified,
      selected: true
    });
  }

  function pushLiteral(tokens, value) {
    if (!value) return;
    const previous = tokens[tokens.length - 1];
    if (previous && previous.type === "literal") {
      previous.value += value;
    } else {
      tokens.push({ type: "literal", value });
    }
  }

  function tokenizeSchema(schema, options = {}) {
    const allowSystemVariables = options.allowSystemVariables !== false;
    const blockAdjacentPlaceholders = options.blockAdjacentPlaceholders === true;
    const tokens = [];
    const errors = [];
    const placeholders = [];
    const systemVariables = [];
    const source = String(schema || "");
    let index = 0;

    while (index < source.length) {
      const char = source[index];

      if (char === "%") {
        if (source[index + 1] === "%") {
          pushLiteral(tokens, "%");
          index += 2;
          continue;
        }

        const remaining = source.slice(index);
        const match = remaining.match(/^%[A-Za-z][A-Za-z0-9_]*/);
        if (!match) {
          errors.push(`Invalid placeholder near "${remaining.slice(0, 12)}". Use %[A-Za-z][A-Za-z0-9_]*.`);
          pushLiteral(tokens, char);
          index += 1;
          continue;
        }

        const name = match[0].slice(1);
        tokens.push({ type: "placeholder", name });
        placeholders.push(name);
        index += match[0].length;
        continue;
      }

      if (char === "@" && allowSystemVariables) {
        const remaining = source.slice(index);
        const match = remaining.match(/^@[A-Za-z][A-Za-z0-9_]*/);
        if (!match) {
          errors.push(`Invalid system variable near "${remaining.slice(0, 12)}".`);
          pushLiteral(tokens, char);
          index += 1;
          continue;
        }

        const name = match[0].slice(1);
        tokens.push({ type: "systemVariable", name });
        systemVariables.push(name);
        index += match[0].length;
        continue;
      }

      let literal = char;
      index += 1;
      while (index < source.length) {
        const next = source[index];
        if (next === "%" || (next === "@" && allowSystemVariables)) break;
        literal += next;
        index += 1;
      }
      pushLiteral(tokens, literal);
    }

    if (blockAdjacentPlaceholders) {
      for (let i = 0; i < tokens.length - 1; i += 1) {
        if (tokens[i].type === "placeholder" && tokens[i + 1].type === "placeholder") {
          errors.push(`Adjacent placeholders %${tokens[i].name}%${tokens[i + 1].name} are ambiguous in input schemas.`);
        }
      }
    }

    return {
      tokens,
      errors,
      placeholders: uniqueArray(placeholders),
      systemVariables: uniqueArray(systemVariables)
    };
  }

  function validateOutputSchema(outputParse, inputPlaceholders, options = {}) {
    const errors = [];
    const warnings = [];
    const knownPlaceholders = new Set(inputPlaceholders);

    outputParse.placeholders.forEach((name) => {
      if (!knownPlaceholders.has(name)) {
        errors.push(`Output schema uses unknown placeholder: %${name}.`);
      }
    });

    outputParse.systemVariables.forEach((name) => {
      if (RESERVED_SYSTEM_VARIABLES.has(name)) {
        errors.push(`System variable @${name} is reserved for future conflict numbering.`);
      } else if (!SUPPORTED_SYSTEM_VARIABLES.has(name)) {
        errors.push(`Unsupported system variable: @${name}.`);
      }
    });

    if (options.extensionMode === "preserve" && !outputParse.systemVariables.includes("ext")) {
      warnings.push("Output schema does not include @ext; generated names may lose extensions.");
    }

    return { errors, warnings };
  }

  function buildMatcher(tokens) {
    const captureOrder = [];
    let pattern = "^";

    tokens.forEach((token) => {
      if (token.type === "literal") {
        pattern += escapeRegex(token.value);
      } else if (token.type === "placeholder") {
        captureOrder.push(token.name);
        pattern += "(.+?)";
      }
    });

    pattern += "$";
    return { regex: new RegExp(pattern), captureOrder };
  }

  function matchFilename(file, inputTokens, extensionMode) {
    const valueToMatch = extensionMode === "fullFilename" ? file.name : file.basename;
    const matcher = buildMatcher(inputTokens);
    const match = valueToMatch.match(matcher.regex);

    if (!match) {
      return {
        matched: false,
        captures: {},
        error: "Filename does not match the input schema."
      };
    }

    const captures = {};
    for (let i = 0; i < matcher.captureOrder.length; i += 1) {
      const name = matcher.captureOrder[i];
      const value = match[i + 1];
      if (Object.prototype.hasOwnProperty.call(captures, name) && captures[name] !== value) {
        return {
          matched: false,
          captures: {},
          error: `Repeated placeholder %${name} captured different values.`
        };
      }
      captures[name] = value;
    }

    return { matched: true, captures, error: null };
  }

  function getSystemVariables(file) {
    return {
      ext: file.extension,
      basename: file.basename,
      filename: file.name
    };
  }

  function renderOutput(tokens, captures, systemVariables) {
    let output = "";
    tokens.forEach((token) => {
      if (token.type === "literal") {
        output += token.value;
      } else if (token.type === "placeholder") {
        output += captures[token.name] || "";
      } else if (token.type === "systemVariable") {
        output += systemVariables[token.name] || "";
      }
    });
    return output;
  }

  function validatePathSegment(name, label) {
    const errors = [];
    const value = String(name);

    if (value.length === 0) {
      errors.push(`${label} is empty.`);
    }
    if (value === "." || value === "..") {
      errors.push(`${label} cannot be . or ..`);
    }
    if (INVALID_PATH_SEGMENT_CHARS.test(value)) {
      errors.push(`${label} contains characters blocked by strict cross-platform validation.`);
    }
    if (/[ .]$/.test(value)) {
      errors.push(`${label} cannot end with a space or dot.`);
    }
    if (value.length > 255) {
      errors.push(`${label} is longer than 255 characters.`);
    }

    const baseName = value.split(".")[0].replace(/[ .]+$/g, "").toUpperCase();
    if (WINDOWS_RESERVED_NAMES.has(baseName)) {
      errors.push(`${label} uses reserved Windows device name: ${baseName}.`);
    }

    return errors;
  }

  function validateTargetPath(path) {
    const errors = [];
    const value = String(path);

    if (value.length === 0) {
      return ["Output path is empty."];
    }
    if (value.startsWith("/")) {
      errors.push("Output path must be relative to the selected folder.");
    }
    if (value.endsWith("/")) {
      errors.push("Output path must end with a filename, not a folder.");
    }
    if (value.includes("//")) {
      errors.push("Output path cannot contain empty folder segments.");
    }
    if (value.length > 1024) {
      errors.push("Output path is longer than 1024 characters.");
    }

    value.split("/").forEach((segment, index, segments) => {
      const isLast = index === segments.length - 1;
      const label = isLast ? "Output filename" : "Output folder";
      errors.push(...validatePathSegment(segment, label));
    });

    return errors;
  }

  function validateFilename(name) {
    const errors = validatePathSegment(name, "Output filename");
    if (String(name).includes("/")) {
      errors.push("Output filename cannot contain folder separators.");
    }
    return errors;
  }

  function getTargetDirectory(targetPath) {
    const value = String(targetPath || "");
    const slashIndex = value.lastIndexOf("/");
    return slashIndex === -1 ? "" : value.slice(0, slashIndex);
  }

  function getTargetFilename(targetPath) {
    const value = String(targetPath || "");
    const slashIndex = value.lastIndexOf("/");
    return slashIndex === -1 ? value : value.slice(slashIndex + 1);
  }

  function hasControlCharacters(value) {
    return /[\u0000-\u001f]/.test(String(value));
  }

  function normalizeCase(value, caseSensitivity) {
    return caseSensitivity === "insensitive" ? String(value).toLocaleLowerCase() : String(value);
  }

  function createBasePlanItems(files, inputParse, outputParse, request, schemaErrors) {
    const items = [];

    files.forEach((file) => {
      const selected = file.selected !== false;
      const item = {
        id: file.id,
        selected,
        sourceName: file.name,
        sourceRelativePath: file.name,
        targetName: null,
        targetRelativePath: null,
        matched: false,
        captures: {},
        systemVariables: getSystemVariables(file),
        status: "skipped",
        warnings: [],
        errors: []
      };

      if (schemaErrors.length > 0) {
        item.errors.push(...schemaErrors);
        item.status = "invalidOutput";
        items.push(item);
        return;
      }

      if (hasControlCharacters(file.name)) {
        item.errors.push("Source filename contains control characters and cannot be scripted in v1.");
        item.status = "invalidOutput";
        items.push(item);
        return;
      }

      const match = matchFilename(file, inputParse.tokens, request.extensionMode);
      if (!match.matched) {
        item.errors.push(match.error);
        item.status = "notMatched";
        items.push(item);
        return;
      }

      item.matched = true;
      item.captures = match.captures;
      item.targetRelativePath = renderOutput(outputParse.tokens, item.captures, item.systemVariables);
      item.targetName = getTargetFilename(item.targetRelativePath);

      const targetPathErrors = validateTargetPath(item.targetRelativePath);
      if (targetPathErrors.length > 0) {
        item.errors.push(...targetPathErrors);
        item.status = "invalidOutput";
      } else {
        item.status = "ready";
      }

      if (request.extensionMode === "preserve" && !outputParse.systemVariables.includes("ext")) {
        item.warnings.push("Output does not include @ext.");
      }

      if (item.targetRelativePath === item.sourceName) {
        item.warnings.push("Target name is unchanged.");
      }

      items.push(item);
    });

    return items;
  }

  function applyConflictDetection(items, files, caseSensitivity) {
    const selectedCandidates = items.filter((item) => item.selected && item.matched && item.errors.length === 0 && item.targetRelativePath !== null);
    const exactTargetGroups = new Map();
    const foldedTargetGroups = new Map();
    const fileByName = new Map();
    const movingSourceNames = new Set();

    files.forEach((file) => {
      fileByName.set(file.name, file);
    });

    selectedCandidates.forEach((item) => {
      if (item.targetRelativePath !== item.sourceName) {
        movingSourceNames.add(item.sourceName);
      }

      const exactKey = item.targetRelativePath;
      const foldedKey = normalizeCase(item.targetRelativePath, "insensitive");
      if (!exactTargetGroups.has(exactKey)) exactTargetGroups.set(exactKey, []);
      if (!foldedTargetGroups.has(foldedKey)) foldedTargetGroups.set(foldedKey, []);
      exactTargetGroups.get(exactKey).push(item);
      foldedTargetGroups.get(foldedKey).push(item);
    });

    exactTargetGroups.forEach((group) => {
      if (group.length > 1) {
        group.forEach((item) => {
          item.errors.push(`Duplicate output target: ${item.targetRelativePath}.`);
          item.status = "conflict";
        });
      }
    });

    if (caseSensitivity === "insensitive") {
      foldedTargetGroups.forEach((group) => {
        const exactNames = uniqueArray(group.map((item) => item.targetRelativePath));
        if (exactNames.length > 1) {
          group.forEach((item) => {
            item.errors.push(`Case-insensitive duplicate target: ${item.targetRelativePath}.`);
            item.status = "conflict";
          });
        }
      });
    }

    selectedCandidates.forEach((item) => {
      if (item.errors.length > 0) return;

      const targetDirectory = getTargetDirectory(item.targetRelativePath);
      const topLevelTargetFolder = targetDirectory.split("/")[0];
      if (topLevelTargetFolder && fileByName.has(topLevelTargetFolder)) {
        item.errors.push(`Target folder conflicts with an existing file: ${topLevelTargetFolder}.`);
        item.status = "wouldOverwrite";
      }

      const existingExact = targetDirectory ? null : fileByName.get(item.targetRelativePath);
      if (existingExact && existingExact.name !== item.sourceName) {
        if (movingSourceNames.has(existingExact.name)) {
          item.warnings.push("Target is currently another selected source; the script uses temporary names.");
        } else {
          item.errors.push(`Target already exists in the selected folder: ${item.targetRelativePath}.`);
          item.status = "wouldOverwrite";
        }
      }

      if (caseSensitivity === "insensitive") {
        const foldedTarget = normalizeCase(item.targetRelativePath, "insensitive");
        const caseMatch = targetDirectory
          ? null
          : files.find((file) => normalizeCase(file.name, "insensitive") === foldedTarget && file.name !== item.sourceName);
        if (caseMatch && !movingSourceNames.has(caseMatch.name)) {
          item.errors.push(`Target conflicts with existing filename by case only: ${caseMatch.name}.`);
          item.status = "wouldOverwrite";
        }

        if (normalizeCase(item.sourceName, "insensitive") === foldedTarget && item.sourceName !== item.targetRelativePath) {
          item.warnings.push("Case-only rename will be applied through a temporary name.");
        }
      }

      if (item.errors.length === 0) {
        item.status = "ready";
      }
    });
  }

  function summarizePlan(items, schemaErrors, schemaWarnings) {
    const selectedItems = items.filter((item) => item.selected);
    const selectedReadyItems = selectedItems.filter((item) => item.status === "ready");
    const selectedBlockingItems = selectedItems.filter((item) => item.status !== "ready");
    const canGenerateScript = schemaErrors.length === 0 && selectedReadyItems.length > 0 && selectedBlockingItems.length === 0;

    return {
      totalFiles: items.length,
      matchedFiles: items.filter((item) => item.matched).length,
      unmatchedFiles: items.filter((item) => item.status === "notMatched").length,
      readyFiles: items.filter((item) => item.status === "ready").length,
      conflictedFiles: items.filter((item) => item.status === "conflict" || item.status === "wouldOverwrite").length,
      invalidFiles: items.filter((item) => item.status === "invalidOutput").length,
      selectedFiles: selectedItems.length,
      selectedReadyFiles: selectedReadyItems.length,
      canGenerateScript,
      schemaErrors,
      schemaWarnings
    };
  }

  function createRenamePlan(request) {
    const files = request.files || [];
    const inputSchema = request.inputSchema || "";
    const outputSchema = request.outputSchema || "";
    const extensionMode = request.extensionMode || "preserve";
    const caseSensitivity = request.caseSensitivity || "insensitive";

    const inputParse = tokenizeSchema(inputSchema, {
      allowSystemVariables: false,
      blockAdjacentPlaceholders: true
    });
    const outputParse = tokenizeSchema(outputSchema, {
      allowSystemVariables: true,
      blockAdjacentPlaceholders: false
    });
    const outputValidation = validateOutputSchema(outputParse, inputParse.placeholders, { extensionMode });
    const schemaErrors = [
      ...inputParse.errors.map((error) => `Input schema: ${error}`),
      ...outputParse.errors.map((error) => `Output schema: ${error}`),
      ...outputValidation.errors
    ];
    const schemaWarnings = outputValidation.warnings;

    if (!inputSchema.trim()) {
      schemaErrors.push("Input schema is required.");
    }
    if (!outputSchema.trim()) {
      schemaErrors.push("Output schema is required.");
    }

    const items = createBasePlanItems(files, inputParse, outputParse, { extensionMode }, schemaErrors);
    if (schemaErrors.length === 0) {
      applyConflictDetection(items, files, caseSensitivity);
    }

    return {
      createdAt: new Date().toISOString(),
      inputSchema,
      outputSchema,
      extensionMode,
      caseSensitivity,
      items,
      validation: summarizePlan(items, schemaErrors, schemaWarnings),
      inputTokens: inputParse.tokens,
      outputTokens: outputParse.tokens
    };
  }

  function getScriptItems(plan) {
    return plan.items.filter((item) => item.selected && item.status === "ready");
  }

  function generateRenameScript(plan) {
    const items = getScriptItems(plan);
    if (items.length === 0) {
      throw new Error("No selected ready files to include in the script.");
    }

    const oldNames = items.map((item) => item.sourceName);
    const newNames = items.map((item) => item.targetRelativePath);
    const oldArray = oldNames.map((name) => `  ${shellQuote(name)}`).join("\n");
    const newArray = newNames.map((name) => `  ${shellQuote(name)}`).join("\n");
    const generatedAt = plan.createdAt || new Date().toISOString();

    return `#!/usr/bin/env bash
set -euo pipefail

# Schema Rename Script
# Generated: ${generatedAt}
# Run from the folder containing the selected files.
# Dry-run:
#   bash rename.sh
# Apply:
#   bash rename.sh --force

FORCE=false

if [[ "$#" -gt 1 ]]; then
  echo "Usage: bash rename.sh [--force]" >&2
  exit 2
fi

if [[ "\${1:-}" == "--force" ]]; then
  FORCE=true
elif [[ "\${1:-}" != "" ]]; then
  echo "Unknown option: \${1:-}" >&2
  echo "Usage: bash rename.sh [--force]" >&2
  exit 2
fi

OLD_NAMES=(
${oldArray}
)

NEW_NAMES=(
${newArray}
)

COUNT="\${#OLD_NAMES[@]}"

print_header() {
  echo "Schema Rename Script"
  if [[ "$FORCE" == true ]]; then
    echo "Mode: FORCE"
  else
    echo "Mode: DRY RUN"
  fi
  echo
}

is_moving_source() {
  local candidate="$1"
  local i
  for ((i = 0; i < COUNT; i++)); do
    if [[ "\${OLD_NAMES[$i]}" == "$candidate" && "\${OLD_NAMES[$i]}" != "\${NEW_NAMES[$i]}" ]]; then
      return 0
    fi
  done
  return 1
}

validate_plan() {
  local i j old new other_new

  if [[ "$COUNT" -eq 0 ]]; then
    echo "No rename pairs are present." >&2
    exit 1
  fi

  for ((i = 0; i < COUNT; i++)); do
    old="\${OLD_NAMES[$i]}"
    new="\${NEW_NAMES[$i]}"

    if [[ -z "$old" || -z "$new" ]]; then
      echo "Empty source or target at row $((i + 1))." >&2
      exit 1
    fi

    validate_relative_target "$new"
    validate_target_directory "$new"

    if [[ ! -e "$old" ]]; then
      echo "Missing source: $old" >&2
      exit 1
    fi

    for ((j = i + 1; j < COUNT; j++)); do
      other_new="\${NEW_NAMES[$j]}"
      if [[ "$new" == "$other_new" ]]; then
        echo "Duplicate target in script: $new" >&2
        exit 1
      fi
    done

    if [[ "$old" != "$new" && -e "$new" ]] && ! is_moving_source "$new"; then
      echo "Target already exists: $new" >&2
      exit 1
    fi
  done
}

validate_relative_target() {
  local path="$1" component

  if [[ -z "$path" ]]; then
    echo "Empty target path." >&2
    exit 1
  fi
  if [[ "$path" == /* ]]; then
    echo "Target must be relative: $path" >&2
    exit 1
  fi
  if [[ "$path" == */ ]]; then
    echo "Target must end with a filename: $path" >&2
    exit 1
  fi
  if [[ "$path" == *"//"* ]]; then
    echo "Target contains an empty folder segment: $path" >&2
    exit 1
  fi

  IFS='/' read -ra TARGET_PARTS <<< "$path"
  for component in "\${TARGET_PARTS[@]}"; do
    if [[ "$component" == "." || "$component" == ".." ]]; then
      echo "Target cannot contain . or .. segments: $path" >&2
      exit 1
    fi
  done
}

target_dir() {
  local path="$1"
  if [[ "$path" == */* ]]; then
    printf '%s\\n' "\${path%/*}"
  else
    printf '\\n'
  fi
}

validate_target_directory() {
  local path="$1" dir component prefix
  dir="$(target_dir "$path")"
  if [[ -z "$dir" ]]; then
    return 0
  fi

  prefix=""
  IFS='/' read -ra DIR_PARTS <<< "$dir"
  for component in "\${DIR_PARTS[@]}"; do
    if [[ -z "$prefix" ]]; then
      prefix="$component"
    else
      prefix="$prefix/$component"
    fi

    if [[ -e "$prefix" && ! -d "$prefix" ]]; then
      echo "Target parent is not a directory: $prefix" >&2
      exit 1
    fi
  done
}

print_plan() {
  local i
  echo "Planned renames:"
  echo
  for ((i = 0; i < COUNT; i++)); do
    echo "[$((i + 1))/$COUNT] \${OLD_NAMES[$i]}"
    echo "    --> \${NEW_NAMES[$i]}"
  done
  echo
}

prepare_temp_names() {
  local i tmp
  RUN_ID="$(date +%Y%m%d%H%M%S)_$$"
  TMP_NAMES=()

  for ((i = 0; i < COUNT; i++)); do
    tmp=".rename_tmp_\${RUN_ID}_$i"
    if [[ -e "$tmp" ]]; then
      echo "Temporary file already exists: $tmp" >&2
      exit 1
    fi
    TMP_NAMES+=("$tmp")
  done
}

ensure_target_directories() {
  local i dir

  for ((i = 0; i < COUNT; i++)); do
    dir="$(target_dir "\${NEW_NAMES[$i]}")"
    if [[ -n "$dir" ]]; then
      mkdir -p -- "$dir"
    fi
  done
}

print_header
print_plan
echo "Validating..."
validate_plan

if [[ "$FORCE" != true ]]; then
  echo
  echo "No files were renamed."
  echo "Run with --force to apply these changes:"
  echo "  bash rename.sh --force"
  exit 0
fi

prepare_temp_names

echo "Creating target folders..."
ensure_target_directories

echo "Applying temporary renames..."
for ((i = 0; i < COUNT; i++)); do
  old="\${OLD_NAMES[$i]}"
  new="\${NEW_NAMES[$i]}"
  tmp="\${TMP_NAMES[$i]}"
  if [[ "$old" != "$new" ]]; then
    mv -- "$old" "$tmp"
  fi
done

echo "Applying final renames..."
for ((i = 0; i < COUNT; i++)); do
  old="\${OLD_NAMES[$i]}"
  new="\${NEW_NAMES[$i]}"
  tmp="\${TMP_NAMES[$i]}"
  if [[ "$old" != "$new" ]]; then
    mv -- "$tmp" "$new"
  fi
done

echo "Done."
`;
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "text/x-shellscript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function initApp(doc) {
    const state = {
      files: [],
      ignoredNestedCount: 0,
      inputSchema: DEFAULT_INPUT_SCHEMA,
      outputSchema: DEFAULT_OUTPUT_SCHEMA,
      extensionMode: "preserve",
      caseSensitivity: "insensitive",
      selectedIds: new Set(),
      lastScript: ""
    };

    const els = {
      folderInput: doc.getElementById("folderInput"),
      folderSummary: doc.getElementById("folderSummary"),
      folderNotice: doc.getElementById("folderNotice"),
      headerStatus: doc.getElementById("headerStatus"),
      inputSchema: doc.getElementById("inputSchema"),
      outputSchema: doc.getElementById("outputSchema"),
      extensionMode: doc.getElementById("extensionMode"),
      caseSensitivity: doc.getElementById("caseSensitivity"),
      schemaMessages: doc.getElementById("schemaMessages"),
      capturePreview: doc.getElementById("capturePreview"),
      previewBody: doc.getElementById("previewBody"),
      planSummary: doc.getElementById("planSummary"),
      scriptSummary: doc.getElementById("scriptSummary"),
      scriptPreview: doc.getElementById("scriptPreview"),
      generateScriptButton: doc.getElementById("generateScriptButton"),
      copyScriptButton: doc.getElementById("copyScriptButton"),
      downloadScriptButton: doc.getElementById("downloadScriptButton"),
      selectReadyButton: doc.getElementById("selectReadyButton"),
      clearSelectionButton: doc.getElementById("clearSelectionButton")
    };

    doc.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (STRINGS[key]) node.textContent = STRINGS[key];
    });

    els.inputSchema.value = state.inputSchema;
    els.outputSchema.value = state.outputSchema;

    function getCurrentPlan() {
      return createRenamePlan({
        files: state.files.map((file) => ({ ...file, selected: state.selectedIds.has(file.id) })),
        inputSchema: state.inputSchema,
        outputSchema: state.outputSchema,
        extensionMode: state.extensionMode,
        caseSensitivity: state.caseSensitivity
      });
    }

    function clearGeneratedScript() {
      state.lastScript = "";
      els.scriptPreview.value = "";
    }

    function renderMessages(plan) {
      els.schemaMessages.innerHTML = "";
      const messages = [
        ...plan.validation.schemaErrors.map((text) => ({ type: "error", text })),
        ...plan.validation.schemaWarnings.map((text) => ({ type: "warning", text }))
      ];

      if (messages.length === 0) {
        const node = doc.createElement("div");
        node.className = "message info";
        node.textContent = "Schemas are valid.";
        els.schemaMessages.appendChild(node);
        return;
      }

      messages.forEach((message) => {
        const node = doc.createElement("div");
        node.className = `message ${message.type}`;
        node.textContent = message.text;
        els.schemaMessages.appendChild(node);
      });
    }

    function renderCaptures(plan) {
      els.capturePreview.innerHTML = "";
      const item = plan.items.find((candidate) => candidate.matched) || null;
      if (!item) {
        const dt = doc.createElement("dt");
        const dd = doc.createElement("dd");
        dt.textContent = "Waiting";
        dd.textContent = state.files.length === 0 ? "Choose a folder." : "No filenames match yet.";
        els.capturePreview.append(dt, dd);
        return;
      }

      Object.entries(item.captures).forEach(([name, value]) => {
        const dt = doc.createElement("dt");
        const dd = doc.createElement("dd");
        dt.textContent = `%${name}`;
        dd.textContent = value;
        els.capturePreview.append(dt, dd);
      });

      Object.entries(item.systemVariables).forEach(([name, value]) => {
        const dt = doc.createElement("dt");
        const dd = doc.createElement("dd");
        dt.textContent = `@${name}`;
        dd.textContent = value || "(empty)";
        els.capturePreview.append(dt, dd);
      });
    }

    function renderPreview(plan) {
      els.previewBody.innerHTML = "";

      if (plan.items.length === 0) {
        const row = doc.createElement("tr");
        const cell = doc.createElement("td");
        cell.colSpan = 6;
        cell.textContent = "Choose a folder to begin.";
        row.appendChild(cell);
        els.previewBody.appendChild(row);
        return;
      }

      plan.items.forEach((item) => {
        const row = doc.createElement("tr");
        const hasWarnings = item.warnings.length > 0 && item.errors.length === 0;
        row.className = item.status === "ready" ? (hasWarnings ? "row-warning" : "row-ready") : "row-blocked";

        const selectCell = doc.createElement("td");
        const checkbox = doc.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = item.selected;
        checkbox.setAttribute("data-file-id", item.id);
        checkbox.setAttribute("aria-label", `Include ${item.sourceName}`);
        selectCell.appendChild(checkbox);

        const statusCell = doc.createElement("td");
        const pill = doc.createElement("span");
        pill.className = `status-pill ${item.status === "ready" ? (hasWarnings ? "warning" : "ready") : "blocked"}`;
        pill.textContent = STATUS_LABELS[item.status] || item.status;
        statusCell.appendChild(pill);

        const oldCell = doc.createElement("td");
        oldCell.className = "filename";
        oldCell.textContent = item.sourceName;

        const newCell = doc.createElement("td");
        newCell.className = item.targetRelativePath ? "filename" : "muted";
        newCell.textContent = item.targetRelativePath || "-";

        const captureCell = doc.createElement("td");
        captureCell.textContent = Object.entries(item.captures)
          .map(([name, value]) => `%${name}=${value}`)
          .join(", ") || "-";

        const messageCell = doc.createElement("td");
        const messages = [...item.errors, ...item.warnings];
        messageCell.textContent = messages.join(" ") || "-";

        row.append(selectCell, statusCell, oldCell, newCell, captureCell, messageCell);
        els.previewBody.appendChild(row);
      });
    }

    function renderSummaries(plan) {
      const loadedText = `${state.files.length} top-level file${state.files.length === 1 ? "" : "s"} loaded`;
      const ignoredText = state.ignoredNestedCount > 0 ? `, ${state.ignoredNestedCount} nested ignored` : "";
      els.folderSummary.textContent = state.files.length ? `${loadedText}${ignoredText}` : "No files loaded";
      els.headerStatus.textContent = state.files.length ? `${plan.validation.selectedFiles} selected / ${state.files.length} loaded` : "No files loaded";
      els.folderNotice.textContent = state.ignoredNestedCount > 0
        ? `${state.ignoredNestedCount} nested file${state.ignoredNestedCount === 1 ? " was" : "s were"} ignored for v1.`
        : "Top-level files only in v1.";
      els.planSummary.textContent = `${plan.validation.readyFiles} ready, ${plan.validation.unmatchedFiles} unmatched, ${plan.validation.conflictedFiles + plan.validation.invalidFiles} blocked, ${plan.validation.selectedFiles} selected.`;
      els.scriptSummary.textContent = state.lastScript ? `${getScriptItems(plan).length} rename pair${getScriptItems(plan).length === 1 ? "" : "s"} in script` : "No script generated";
    }

    function renderControls(plan) {
      els.generateScriptButton.disabled = !plan.validation.canGenerateScript;
      els.copyScriptButton.disabled = !state.lastScript;
      els.downloadScriptButton.disabled = !state.lastScript;
      els.selectReadyButton.disabled = plan.items.length === 0;
      els.clearSelectionButton.disabled = state.selectedIds.size === 0;
    }

    function render() {
      const plan = getCurrentPlan();
      renderMessages(plan);
      renderCaptures(plan);
      renderPreview(plan);
      renderSummaries(plan);
      renderControls(plan);
      return plan;
    }

    els.folderInput.addEventListener("change", (event) => {
      const browserFiles = Array.from(event.target.files || []);
      const topLevelFiles = [];
      let ignoredNestedCount = 0;

      browserFiles.forEach((file, index) => {
        const relativePath = file.webkitRelativePath || file.name;
        if (isNestedRelativePath(relativePath)) {
          ignoredNestedCount += 1;
          return;
        }
        topLevelFiles.push(createFileEntryFromBrowserFile(file, index));
      });

      state.files = topLevelFiles;
      state.ignoredNestedCount = ignoredNestedCount;
      state.selectedIds = new Set(topLevelFiles.map((file) => file.id));
      clearGeneratedScript();
      render();
    });

    els.inputSchema.addEventListener("input", () => {
      state.inputSchema = els.inputSchema.value;
      clearGeneratedScript();
      render();
    });

    els.outputSchema.addEventListener("input", () => {
      state.outputSchema = els.outputSchema.value;
      clearGeneratedScript();
      render();
    });

    els.extensionMode.addEventListener("change", () => {
      state.extensionMode = els.extensionMode.value;
      clearGeneratedScript();
      render();
    });

    els.caseSensitivity.addEventListener("change", () => {
      state.caseSensitivity = els.caseSensitivity.value;
      clearGeneratedScript();
      render();
    });

    els.previewBody.addEventListener("change", (event) => {
      const fileId = event.target.getAttribute("data-file-id");
      if (!fileId) return;
      if (event.target.checked) {
        state.selectedIds.add(fileId);
      } else {
        state.selectedIds.delete(fileId);
      }
      clearGeneratedScript();
      render();
    });

    els.selectReadyButton.addEventListener("click", () => {
      const plan = getCurrentPlan();
      state.selectedIds = new Set(plan.items.filter((item) => item.status === "ready").map((item) => item.id));
      clearGeneratedScript();
      render();
    });

    els.clearSelectionButton.addEventListener("click", () => {
      state.selectedIds = new Set();
      clearGeneratedScript();
      render();
    });

    els.generateScriptButton.addEventListener("click", () => {
      const plan = render();
      if (!plan.validation.canGenerateScript) return;
      state.lastScript = generateRenameScript(plan);
      els.scriptPreview.value = state.lastScript;
      renderControls(plan);
      renderSummaries(plan);
    });

    els.copyScriptButton.addEventListener("click", async () => {
      if (!state.lastScript) return;
      await navigator.clipboard.writeText(state.lastScript);
      els.scriptSummary.textContent = "Script copied";
    });

    els.downloadScriptButton.addEventListener("click", () => {
      if (!state.lastScript) return;
      downloadTextFile("rename.sh", state.lastScript);
    });

    render();
  }

  const api = {
    STRINGS,
    DEFAULT_INPUT_SCHEMA,
    DEFAULT_OUTPUT_SCHEMA,
    tokenizeSchema,
    validateOutputSchema,
    splitExtension,
    createFileEntryFromName,
    createRenamePlan,
    getScriptItems,
    generateRenameScript,
    shellQuote,
    validateFilename,
    validateTargetPath,
    matchFilename,
    renderOutput
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.RemanerRenamer = api;
    if (root.document) {
      root.document.addEventListener("DOMContentLoaded", () => initApp(root.document));
    }
  }
})(typeof window !== "undefined" ? window : undefined);
