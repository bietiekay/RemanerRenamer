# Schema Syntax

Schemas describe how existing filenames are read and how new filenames are
rendered.

## Placeholders

User placeholders begin with `%` and use this format:

```regex
%[A-Za-z][A-Za-z0-9_]*
```

Valid examples:

```text
%a
%title
%episode_2
%myCustomThing
```

Invalid examples:

```text
%
%1
%-
% title
```

Placeholder names have no built-in meaning. `%y` is not automatically a year,
and `%title` is not automatically a title.

## Literal Percent Signs

Use `%%` for a literal percent sign:

```text
%title %% complete
```

This can match:

```text
Project 50 % complete
```

## System Variables

Output schemas can use system variables:

```text
@ext       original extension without dot
@basename  original filename without extension
@filename  original full filename
```

`@n` is reserved for future conflict numbering and is not available in v1.

## Extension Modes

Preserve extension mode is the default. The input schema matches the basename
only, and the output schema should include `@ext` when the extension should be
kept:

```text
Input:  %a-%b-%c - %title - %suffix
Output: %c%b%a - %title.@ext
```

Full filename mode matches the complete filename, including extension:

```text
Input:  %a-%b-%c - %title.mp4
Output: %title - %a-%b-%c.mp4
```

## Folder Output

Output schemas may include `/` separators to create a relative folder structure
from captured placeholders and system variables.

```text
Input:  %a-%b-%d - %t
Output: %a/%d/%t.@ext
```

The generated script writes `%t.@ext` into the folder `%d` under the folder
`%a`, relative to the selected folder. Missing folders are created by the script
when it runs with `--force`.

Folder output is transparent: no separate toggle is needed. It activates when
the rendered output path contains `/`.

Safety rules:

- paths must be relative
- empty path segments are blocked
- `.` and `..` path segments are blocked
- every folder and filename segment uses strict cross-platform validation

## Replacements

Replacement rules are optional literal substring replacements that run after the
output schema renders and before validation, conflict detection, preview, and
script generation.

Rules are saved in the browser and applied top-to-bottom. Matching is
case-sensitive.

Example rules:

```text
& -> and
: -> -
```

Rendered output:

```text
AC DC/2026/One & Two: Test.mp4
```

Final output:

```text
AC DC/2026/One and Two- Test.mp4
```

Replacements run on each path segment separately. They can change folder names
and filenames, but they cannot create or remove `/` folder separators. Empty
replacement text is allowed for deleting text. Enabled rules with an empty find
value are invalid.

## Limits

- Adjacent input placeholders such as `%a%b` are blocked because the split point
  is ambiguous.
- Repeated placeholders are allowed only when repeated captures are identical.
- Recursive folder renaming is deferred.
