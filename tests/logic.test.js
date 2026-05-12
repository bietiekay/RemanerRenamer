const assert = require("node:assert/strict");
const {
  DEFAULT_INPUT_SCHEMA,
  DEFAULT_OUTPUT_SCHEMA,
  createFileEntryFromName,
  createRenamePlan,
  generateRenameScript,
  shellQuote,
  tokenizeSchema,
  validateFilename,
  validateTargetPath
} = require("../app.js");

function planFor(names, options = {}) {
  return createRenamePlan({
    files: names.map((name, index) => createFileEntryFromName(name, { index, selected: true })),
    inputSchema: options.inputSchema || DEFAULT_INPUT_SCHEMA,
    outputSchema: options.outputSchema || DEFAULT_OUTPUT_SCHEMA,
    extensionMode: options.extensionMode || "preserve",
    caseSensitivity: options.caseSensitivity || "insensitive"
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
