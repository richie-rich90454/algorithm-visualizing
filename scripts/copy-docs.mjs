import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "docs", ".vitepress", "dist");
const target = path.join(root, "dist", "docs");

if (!existsSync(source)) {
    throw new Error(`VitePress output not found at ${source}`);
}

mkdirSync(path.join(root, "dist"), { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Copied VitePress site to ${target}`);
