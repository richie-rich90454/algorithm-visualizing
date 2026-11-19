import { Glob } from "bun";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dir, "..");
const coreDir = path.join(root, "src", "core");
const algoDir = path.join(coreDir, "algo");
const outFile = path.join(coreDir, "manifest.ts");

type Meta = {
    id: string;
    name: string;
    category: string;
    complexity: { time: string; space: string };
    defaultInput: unknown;
    visualType: string;
};

const files = [...new Glob("**/*.ts").scanSync({ cwd: algoDir })]
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith("-util.ts"))
    .map((f) => path.join(algoDir, f))
    .sort();

const entries: Array<{ meta: Meta; specifier: string }> = [];
for (const file of files) {
    const meta = (await import(pathToFileURL(file).href)).default as Meta;
    const relative = path.relative(coreDir, file).split(path.sep).join("/");
    entries.push({ meta, specifier: `./${relative.slice(0, -3)}` });
}
entries.sort((a, b) => a.meta.id.localeCompare(b.meta.id));

function key(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function serialize(value: unknown, indentation: number): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";

    const pad = " ".repeat(indentation);
    const innerPad = " ".repeat(indentation + 4);

    if (Array.isArray(value)) {
        const parts = value.map((item) => serialize(item, indentation + 4));
        const inline = `[${parts.join(", ")}]`;
        if (inline.length + indentation <= 110) return inline;
        return `[\n${parts.map((part) => innerPad + part).join(",\n")},\n${pad}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const parts = entries.map(([name, item]) => `${key(name)}: ${serialize(item, indentation + 4)}`);
    const inline = `{ ${parts.join(", ")} }`;
    if (inline.length + indentation <= 110) return inline;
    return `{\n${parts.map((part) => innerPad + part).join(",\n")},\n${pad}}`;
}

function block(value: unknown, indentation: number): string {
    return serialize(value, indentation);
}

const lines: string[] = [
    "/**",
    " * manifest.ts - GENERATED. Do not edit by hand.",
    " *",
    " * Lightweight metadata for every algorithm plus a lazy loader per",
    " * module, so the production bundle ships the gallery shell first and",
    " * fetches each algorithm's code only when it is opened. Regenerate",
    " * with: bun scripts/gen-manifest.ts",
    " */",
    "",
    'import type { AlgorithmCategory, AlgorithmComplexity, AlgorithmModule, LayoutType } from "@/types";',
    "",
    "/** Everything the sidebar, search, and info panel need - no run code. */",
    "export interface AlgorithmMeta {",
    "    id: string;",
    "    name: string;",
    "    category: AlgorithmCategory;",
    "    complexity: AlgorithmComplexity;",
    "    defaultInput: unknown;",
    "    visualType: LayoutType;",
    "}",
    "",
    "export const MANIFEST: AlgorithmMeta[] = [",
];

for (const { meta } of entries) {
    lines.push(
        "    {",
        `        id: ${JSON.stringify(meta.id)},`,
        `        name: ${JSON.stringify(meta.name)},`,
        `        category: ${JSON.stringify(meta.category)} as AlgorithmCategory,`,
        `        complexity: ${block(meta.complexity, 8)},`,
        `        defaultInput: JSON.parse(${JSON.stringify(JSON.stringify(meta.defaultInput))}) as unknown,`,
        `        visualType: ${JSON.stringify(meta.visualType)} as LayoutType,`,
        "    },",
    );
}

lines.push(
    "];",
    "",
    "/** Lazy loader per algorithm id - one code-split chunk per module. */",
    "export const LOADERS: Record<string, () => Promise<{ default: AlgorithmModule }>> = {",
);

for (const { meta, specifier } of entries) {
    const key = /^[A-Za-z_$][\w$]*$/.test(meta.id) ? meta.id : JSON.stringify(meta.id);
    lines.push(`    ${key}: () => import(${JSON.stringify(specifier)}),`);
}

lines.push("};", "");

await Bun.write(outFile, lines.join("\n"));
console.log(`Generated manifest.ts with ${entries.length} entries.`);
