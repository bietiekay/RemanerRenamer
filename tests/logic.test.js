const assert = require("node:assert/strict");
const {
  DEFAULT_INPUT_SCHEMA,
  DEFAULT_OUTPUT_SCHEMA,
  applyReplacementRulesToSegment,
  applyReplacementRulesToTargetPath,
  createFileEntryFromName,
  createRenamePlan,
  generateRenameScript,
  loadStoredSchemas,
  saveStoredSchemas,
  shellQuote,
  tokenizeSchema,
  validateFilename,
  validateReplacementRules,
  validateTargetPath
} = require("../app.js");

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function planFor(names, options = {}) {
  return createRenamePlan({
    files: names.map((name, index) => createFileEntryFromName(name, { index, selected: true })),
    inputSchema: options.inputSchema || DEFAULT_INPUT_SCHEMA,
    outputSchema: options.outputSchema || DEFAULT_OUTPUT_SCHEMA,
    extensionMode: options.extensionMode || "preserve",
    caseSensitivity: options.caseSensitivity || "insensitive",
    replacements: options.replacements || []
  });
}

{
  const parsed = tokenizeSchema("%title %% complete", {
    allowSystemVariables: false,
    blockAdjacentPlaceholders: true
  });
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.tokens, [
    { type: "placeholder", name: "title" },
    { type: "literal", value: " % complete" }
  ]);
}

{
  const parsed = tokenizeSchema("%a%b", {
    allowSystemVariables: false,
    blockAdjacentPlaceholders: true
  });
  assert.equal(parsed.errors.length, 1);
}

{
  const parsed = tokenizeSchema("%{a}__(S%{b}_E%{c})%{y}", {
    allowSystemVariables: false,
    blockAdjacentPlaceholders: true
  });
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.tokens, [
    { type: "placeholder", name: "a" },
    { type: "literal", value: "__(S" },
    { type: "placeholder", name: "b" },
    { type: "literal", value: "_E" },
    { type: "placeholder", name: "c" },
    { type: "literal", value: ")" },
    { type: "placeholder", name: "y" }
  ]);
}

{
  const parsed = tokenizeSchema("S%{b}E%{c}.@{ext}", {
    allowSystemVariables: true,
    blockAdjacentPlaceholders: false
  });
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.tokens, [
    { type: "literal", value: "S" },
    { type: "placeholder", name: "b" },
    { type: "literal", value: "E" },
    { type: "placeholder", name: "c" },
    { type: "literal", value: "." },
    { type: "systemVariable", name: "ext" }
  ]);
}

{
  const parsed = tokenizeSchema("%{a}%{b}", {
    allowSystemVariables: false,
    blockAdjacentPlaceholders: true
  });
  assert.equal(parsed.errors.length, 1);
}

{
  const storage = createMemoryStorage();
  saveStoredSchemas(storage, {
    inputSchema: "%{title}",
    outputSchema: "%{title}.@ext"
  });
  assert.deepEqual(loadStoredSchemas(storage), {
    inputSchema: "%{title}",
    outputSchema: "%{title}.@ext"
  });
}

{
  const storage = createMemoryStorage();
  saveStoredSchemas(storage, {
    inputSchema: "",
    outputSchema: ""
  });
  assert.deepEqual(loadStoredSchemas(storage), {
    inputSchema: "",
    outputSchema: ""
  });
}

{
  const plan = planFor(["2026-05-01 - Das ist ein - Test.mp4"]);
  assert.equal(plan.validation.canGenerateScript, true);
  assert.equal(plan.items[0].targetName, "01052026 - Das ist ein.mp4");
  assert.deepEqual(plan.items[0].captures, {
    a: "2026",
    b: "05",
    c: "01",
    title: "Das ist ein",
    suffix: "Test"
  });
}

{
  const plan = planFor(["Mittendrin_-_Flughafen_Frankfurt-100_Jahre_Lufthansa__Propeller,_Piloten_und_Pillbox__(S16_E05)-0168821512.mp4"], {
    inputSchema: "%{a}__(S%{b}_E%{c})%{y}",
    outputSchema: "S%{b}E%{c}.@ext"
  });
  assert.equal(plan.validation.canGenerateScript, true);
  assert.equal(plan.items[0].targetName, "S16E05.mp4");
  assert.deepEqual(plan.items[0].captures, {
    a: "Mittendrin_-_Flughafen_Frankfurt-100_Jahre_Lufthansa__Propeller,_Piloten_und_Pillbox",
    b: "16",
    c: "05",
    y: "-0168821512"
  });
}

{
  const plan = planFor(["Alice - Example - Bob.txt"], {
    inputSchema: "%name - %title - %name",
    outputSchema: "%title - %name.@ext"
  });
  assert.equal(plan.items[0].status, "notMatched");
}

{
  const plan = planFor(["Alice - Example - Alice.txt"], {
    inputSchema: "%name - %title - %name",
    outputSchema: "%title - %name.@ext"
  });
  assert.equal(plan.validation.canGenerateScript, true);
  assert.equal(plan.items[0].targetName, "Example - Alice.txt");
}

{
  const plan = planFor(["one.mp4"], {
    inputSchema: "%title",
    outputSchema: "%missing.@ext"
  });
  assert.equal(plan.validation.canGenerateScript, false);
  assert.match(plan.validation.schemaErrors.join(" "), /unknown placeholder/);
}

{
  const rules = [
    { enabled: true, find: "&", replace: "and" },
    { enabled: true, find: "and", replace: "+" }
  ];
  assert.equal(applyReplacementRulesToSegment("A & B", rules), "A + B");
}

{
  const rules = [{ enabled: true, find: " ", replace: "_" }];
  assert.equal(applyReplacementRulesToTargetPath("A B/C D.mp4", rules), "A_B/C_D.mp4");
}

{
  const rules = [{ enabled: true, find: " copy", replace: "" }];
  assert.equal(applyReplacementRulesToTargetPath("Album/Song copy.mp4", rules), "Album/Song.mp4");
}

{
  const validation = validateReplacementRules([{ enabled: true, find: "", replace: "x" }]);
  assert.ok(validation.errors.some((error) => error.includes("empty find")));
}

{
  const validation = validateReplacementRules([{ enabled: false, find: "", replace: "/" }]);
  assert.equal(validation.errors.length, 0);
}

{
  const validation = validateReplacementRules([{ enabled: true, find: "x", replace: "a/b" }]);
  assert.ok(validation.errors.some((error) => error.includes("cannot contain /")));
}

{
  const plan = planFor(["Artist - Song: Part.mp4"], {
    inputSchema: "%artist - %title",
    outputSchema: "%artist/%title.@ext",
    replacements: [{ enabled: true, find: ":", replace: "-" }]
  });
  assert.equal(plan.validation.canGenerateScript, true);
  assert.equal(plan.items[0].rawTargetRelativePath, "Artist/Song: Part.mp4");
  assert.equal(plan.items[0].targetRelativePath, "Artist/Song- Part.mp4");
}

{
  const plan = planFor(["Artist - Song: Part.mp4"], {
    inputSchema: "%artist - %title",
    outputSchema: "%artist/%title.@ext",
    replacements: [{ enabled: true, find: ":", replace: "/" }]
  });
  assert.equal(plan.validation.canGenerateScript, false);
  assert.match(plan.validation.schemaErrors.join(" "), /cannot contain \//);
}

{
  const plan = planFor(["Artist - Song: Part.mp4"], {
    inputSchema: "%artist - %title",
    outputSchema: "%artist/%title.@ext",
    replacements: [{ enabled: true, find: ":", replace: "-" }]
  });
  const script = generateRenameScript(plan);
  assert.match(script, /'Artist\/Song- Part\.mp4'/);
  assert.doesNotMatch(script, /Artist\/Song: Part\.mp4/);
}

{
  assert.deepEqual(validateTargetPath("artist/date/title.mp4"), []);
  assert.ok(validateTargetPath("/artist/date/title.mp4").some((error) => error.includes("relative")));
  assert.ok(validateTargetPath("artist/../title.mp4").some((error) => error.includes(". or ..")));
  assert.ok(validateTargetPath("artist/CON/title.mp4").some((error) => error.includes("reserved Windows")));
  assert.ok(validateFilename("bad/name.mp4").some((error) => error.includes("folder separators")));
  assert.ok(validateFilename("CON.txt").some((error) => error.includes("reserved Windows")));
  assert.ok(validateFilename("name.").some((error) => error.includes("space or dot")));
}

{
  const plan = planFor(["2026-05-01 - Das ist ein - Test.mp4"], {
    outputSchema: "%a/%c%b%a/%title.@ext"
  });
  assert.equal(plan.validation.canGenerateScript, true);
  assert.equal(plan.items[0].targetName, "Das ist ein.mp4");
  assert.equal(plan.items[0].targetRelativePath, "2026/01052026/Das ist ein.mp4");
}

{
  const plan = planFor(["a.mp4", "b.mp4"], {
    inputSchema: "%name",
    outputSchema: "same.@ext"
  });
  assert.equal(plan.validation.canGenerateScript, false);
  assert.equal(plan.items[0].status, "conflict");
  assert.equal(plan.items[1].status, "conflict");
}

{
  const plan = planFor(["A.mp4", "B.mp4"], {
    inputSchema: "%name",
    outputSchema: "%name.mp4",
    extensionMode: "preserve"
  });
  assert.equal(plan.items[0].warnings.includes("Target name is unchanged."), true);
}

{
  const plan = planFor(["John's File.mp4"], {
    inputSchema: "%title",
    outputSchema: "%title - renamed.@ext"
  });
  const script = generateRenameScript(plan);
  assert.match(script, /--force/);
  assert.match(script, /Mode: DRY RUN/);
  assert.match(script, /mkdir -p --/);
  assert.match(script, /mv --/);
  assert.match(script, /\.rename_tmp_/);
  assert.equal(shellQuote("John's File.mp4"), "'John'\\''s File.mp4'");
}

console.log("logic tests passed");
