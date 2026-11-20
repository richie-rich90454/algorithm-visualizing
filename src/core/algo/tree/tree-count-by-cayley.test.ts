/**
 * tree-count-by-cayley.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-count-by-cayley";
import type { VisualFrame } from "@/types";

/** Independent brute force: enumerate all simple graphs with n-1 edges and test connectivity. */
function bruteLabeledTreeCount(n: number): number {
    if (n === 1) {
        return 1;
    }
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            pairs.push([i, j]);
        }
    }
    let count = 0;
    for (let mask = 0; mask < 1 << pairs.length; mask += 1) {
        let edgeCount = 0;
        for (let k = 0; k < pairs.length; k += 1) {
            if (mask & (1 << k)) {
                edgeCount += 1;
            }
        }
        if (edgeCount !== n - 1) {
            continue;
        }
        const adjacency = Array.from({ length: n }, () => [] as number[]);
        for (let k = 0; k < pairs.length; k += 1) {
            if (mask & (1 << k)) {
                const [a, b] = pairs[k] as [number, number];
                adjacency[a]?.push(b);
                adjacency[b]?.push(a);
            }
        }
        const seen = new Set<number>([0]);
        const queue = [0];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            for (const v of adjacency[u] ?? []) {
                if (!seen.has(v)) {
                    seen.add(v);
                    queue.push(v);
                }
            }
        }
        if (seen.size === n) {
            count += 1;
        }
    }
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cayley Tree Count", () => {
    it("matches the independent graph enumeration for small n", () => {
        for (const n of [2, 3, 4]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["formulaCount"]).toBe(bruteLabeledTreeCount(n));
            expect(finalMeta?.["distinctCount"]).toBe(bruteLabeledTreeCount(n));
            expect(finalMeta?.["enumerated"]).toBe(bruteLabeledTreeCount(n));
        }
    });

    it("enumerates all sequences for n equals five", () => {
        const frames = [...mod.run({ n: 5 })];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["formulaCount"]).toBe(125);
        expect(finalMeta?.["distinctCount"]).toBe(125);
        expect(finalMeta?.["enumerated"]).toBe(125);
        expect(frames.length).toBe(127);
    });

    it("handles the one-vertex tree", () => {
        const frames = [...mod.run({ n: 1 })];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["formulaCount"]).toBe(1);
        expect(finalMeta?.["distinctCount"]).toBe(1);
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
