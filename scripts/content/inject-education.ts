/**
 * Injects structured writeups from scripts/content/education/*.json into the
 * matching algorithm modules. Idempotent: a module with an `education` field
 * is left untouched.
 *
 * Usage: bun scripts/content/inject-education.ts
 */

import { Glob } from "bun";

interface Education {
  intuition: string;
  invariants: string[];
  correctness: string;
  complexityRationale: string;
  uses: string[];
  references: string[];
  workedExample: string;
}

const educationFiles = new Glob("scripts/content/education/*.json");
const writeups: Record<string, Education> = {};
for await (const file of educationFiles.scan(".")) {
  const data = await Bun.file(file).json() as Record<string, Education>;
  Object.assign(writeups, data);
}

const modules = new Glob("src/core/algo/**/*.ts");
const found = new Set<string>();
const touched: string[] = [];

for await (const path of modules.scan(".")) {
  if (path.endsWith(".test.ts") || path.includes("-util")) continue;
  const source = await Bun.file(path).text();
  if (source.includes("education:")) continue;

  for (const [id, education] of Object.entries(writeups)) {
    const idPattern = new RegExp(`\\bid:\\s*["']${id}["']`);
    if (!idPattern.test(source)) continue;

    const declaration = /const\s+module\s*:\s*AlgorithmModule\s*=\s*\{/;
    const match = declaration.exec(source);
    if (!match) {
      console.error(`Cannot find module declaration for ${id} in ${path}`);
      continue;
    }

    const serialized = JSON.stringify(education, null, 4)
      .split("\n")
      .map((line, index) => (index === 0 ? line : `    ${line}`))
      .join("\n");
    const insertion = `education: ${serialized},\n`;
    const at = match.index + match[0].length;
    const updated = source.slice(0, at + 1) + "\n    " + insertion + source.slice(at + 1);
    await Bun.write(path, updated);
    found.add(id);
    touched.push(path);
    break;
  }
}

const missing = Object.keys(writeups).filter((id) => !found.has(id));
console.log(`Injected ${touched.length} writeups into modules.`);
if (missing.length) console.log(`Missing targets: ${missing.join(", ")}`);
