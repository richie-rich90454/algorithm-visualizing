import { Glob } from "bun";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dir, "..");
const algoDir = path.join(root, "src", "core", "algo");
const baselineFile = path.join(import.meta.dir, "quality-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

const REQUIRED_FIELDS = [
    "id",
    "name",
    "category",
    "complexity",
    "defaultInput",
    "visualType",
] as const;
const BRITISH = /\b(?:colour|behaviour|centre|organise|realise|normalise|analyse|favourite|neighbour|generalise|labelled|travelling|modelling)\b/gi;
// French source titles in reference lists are proper nouns, not British spellings.
const FOREIGN_TITLES = /\bd'analyse\b/gi;
const MARKER = /\b(?:TODO|FIXME|XXX|HACK|placeholder)\b/i;
const MOJIBAKE = /\uFFFD|\u00EF\u00BF\u00BD|\u00E2\u20AC[\u0080-\u009F\u2018-\u201D]/;

type ModuleShape = {
    id?: unknown;
    name?: unknown;
    category?: unknown;
    complexity?: unknown;
    defaultInput?: unknown;
    visualType?: unknown;
    pseudocode?: unknown;
};

const files = [...new Glob("**/*.ts").scanSync({ cwd: algoDir })]
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith("-util.ts"))
    .map((f) => path.join(algoDir, f))
    .sort();

const current: Record<string, string[]> = {};

for (const file of files) {
    const key = path.relative(root, file).split(path.sep).join("/");
    const violations = new Set<string>();
    const source = await Bun.file(file).text();

    if (MARKER.test(source)) {
        violations.add("todo-marker");
    }
    if (MOJIBAKE.test(source)) {
        violations.add("mojibake");
    }
    const englishText = source.replace(FOREIGN_TITLES, "");
    for (const word of new Set(englishText.match(BRITISH)?.map((w) => w.toLowerCase()) ?? [])) {
        violations.add(`spelling: ${word}`);
    }

    try {
        const mod = (await import(pathToFileURL(file).href)).default as ModuleShape | undefined;
        if (!mod || typeof mod !== "object") {
            violations.add("missing default export");
        } else {
            for (const field of REQUIRED_FIELDS) {
                if (mod[field] === undefined) {
                    violations.add(`missing field: ${field}`);
                }
            }
            const pseudocode = mod.pseudocode;
            if (!Array.isArray(pseudocode)) {
                violations.add("pseudocode missing");
            } else if (pseudocode.length < 5 || pseudocode.length > 12) {
                violations.add(`pseudocode lines: ${pseudocode.length}`);
            }
        }
    } catch (error) {
        violations.add(`import failed: ${(error as Error).message.split("\n")[0]}`);
    }

    if (violations.size) {
        current[key] = [...violations].sort();
    }
}

if (updateBaseline) {
    await Bun.write(baselineFile, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Baseline updated: ${Object.keys(current).length} modules with violations.`);
    process.exit(0);
}

const baseline: Record<string, string[]> = await Bun.file(baselineFile)
    .json()
    .catch(() => ({}));

const newViolations: string[] = [];
let knownCount = 0;
for (const [key, list] of Object.entries(current)) {
    const known = new Set(baseline[key] ?? []);
    for (const violation of list) {
        if (known.has(violation)) {
            knownCount += 1;
        } else {
            newViolations.push(`${key}: ${violation}`);
        }
    }
}

console.log(`Checked ${files.length} modules.`);
console.log(`Known baseline violations: ${knownCount}`);
console.log(`New violations: ${newViolations.length}`);
for (const violation of newViolations) {
    console.log(`  ${violation}`);
}

process.exit(newViolations.length ? 1 : 0);
