/**
 * tree-median.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-median";
import type { VisualFrame } from "@/types";

type Parents = Record<string, string | null>;

/** Brute force: run a BFS from every vertex and sum the distances. */
function bruteMedian(parents: Parents, ids: string[]): { median: string; total: number } {
    let bestId = ids[0] ?? "";
    let bestTotal = Infinity;
    for (const source of ids) {
        let total = 0;
        for (const target of ids) {
            const dist = new Map<string, number>([[source, 0]]);
            const queue = [source];
            while (queue.length > 0) {
                const u = queue.shift() as string;
                for (const [child, parent] of Object.entries(parents)) {
                    if (parent === u && !dist.has(child)) {
                        dist.set(child, (dist.get(u) as number) + 1);
                        queue.push(child);
                    }
                    if (child === u && parent && !dist.has(parent)) {
                        dist.set(parent, (dist.get(u) as number) + 1);
                        queue.push(parent);
                    }
                }
            }
            total += dist.get(target) ?? 0;
        }
        if (total < bestTotal) {
            bestTotal = total;
            bestId = source;
        }
    }
    return { median: bestId, total: bestTotal };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Tree Median", () => {
    it("finds the minimum total-distance vertex on the default input", () => {
        const input = mod.defaultInput as { parentMap: Parents; ids: string[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = bruteMedian(input.parentMap, input.ids);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["median"]).toBe(expected.median);
        expect(finalMeta?.["totalDistance"]).toBe(expected.total);
    });

    it("matches brute force on generated random trees", () => {
        let seed = 5;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 40; t += 1) {
            const n = 2 + (rand() % 8);
            const ids = Array.from({ length: n }, (_, i) => `n${i}`);
            const parents: Parents = { n0: null };
            for (let i = 1; i < n; i += 1) {
                parents[`n${i}`] = `n${rand() % i}`;
            }
            const frames = [...mod.run({ parentMap: parents, ids })];
            checkFrames(frames);
            const expected = bruteMedian(parents, ids);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["totalDistance"]).toBe(expected.total);
        }
    });

    it("handles the single-node tree", () => {
        const frames = [...mod.run({ parentMap: { only: null }, ids: ["only"] })];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["median"]).toBe("only");
        expect(finalMeta?.["totalDistance"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
