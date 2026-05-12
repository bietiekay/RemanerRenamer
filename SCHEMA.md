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

## Limits

- Adjacent input placeholders such as `%a%b` are blocked because the split point
  is ambiguous.
- Repeated placeholders are allowed only when repeated captures are identical.
- Output schemas cannot create subfolders in v1.
- Recursive folder renaming is deferred.
