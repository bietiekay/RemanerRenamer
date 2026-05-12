# Localization

The v1 interface is English-only, but visible UI strings are collected in the
`STRINGS` dictionary in `app.js` where practical.

To add another language:

1. Add a dictionary next to `STRINGS`.
2. Keep string keys stable.
3. Switch dictionaries during app initialization.
4. Review schema examples carefully; placeholder names are user-defined and do
   not need translation unless the example itself changes.

Generated Bash output is currently English-only.
