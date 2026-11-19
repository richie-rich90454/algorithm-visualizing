import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./word-ladder-dp";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        });
        f.edges.forEach((e) => {
            const ids = new Set(f.entities.map((n) => n.id));
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

function differByOne(a: string, b: string): boolean {
    if (a.length !== b.length || a === b) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1;
    return diff === 1;
}

/** Independent BFS shortest ladder length over the same word graph. */
function bfsLength(words: string[], start: string, target: string): number {
    if (!words.includes(start) || !words.includes(target)) return -1;
    const dist = new Map<string, number>([[start, 0]]);
    const queue = [start];
    while (queue.length > 0) {
        const word = queue.shift() as string;
        const d = dist.get(word) ?? 0;
        if (word === target) return d;
        for (const next of words) {
            if (dist.has(next) || !differByOne(word, next)) continue;
            dist.set(next, d + 1);
            queue.push(next);
        }
    }
    return dist.has(target) ? (dist.get(target) as number) : -1;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

describe("WordLadderDp", () => {
    it("matches brute-force BFS on random dictionary graphs", () => {
        const rng = makeRandom(5150);
        const letters = "abcd";
        for (let t = 0; t < 80; t += 1) {
            const size = 4 + Math.floor(rng() * 7);
            const pool = new Set<string>();
            while (pool.size < size) {
                let word = "";
                for (let i = 0; i < 3; i += 1) word += letters[Math.floor(rng() * letters.length)];
                pool.add(word);
            }
            const words = [...pool];
            const start = words[0] as string;
            const target = words[words.length - 1] as string;
            const expected = bfsLength(words, start, target);

            const fs = frames({ start, target, words });
            shapes(fs);
            const last = fs[fs.length - 1];
            const length = Number(last?.meta.length);
            expect(length).toBe(expected);

            const path = last?.meta.path as string[];
            if (expected >= 0) {
                expect(path.length).toBe(expected + 1);
                expect(path[0]).toBe(start);
                expect(path[path.length - 1]).toBe(target);
                for (let i = 1; i < path.length; i += 1) {
                    expect(differByOne(path[i - 1] ?? "", path[i] ?? "")).toBe(true);
                }
            } else {
                expect(path.length).toBe(0);
            }
        }
    });

    it("matches the worked example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta.length)).toBe(4);
        expect(last?.meta.path).toEqual(["hit", "hot", "dot", "dog", "cog"]);
        expect(fs.length).toBeLessThan(40);
    });
});
