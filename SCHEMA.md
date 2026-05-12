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

## Limits

- Adjacent input placeholders such as `%a%b` are blocked because the split point
  is ambiguous.
- Repeated placeholders are allowed only when repeated captures are identical.
- Recursive folder renaming is deferred.
