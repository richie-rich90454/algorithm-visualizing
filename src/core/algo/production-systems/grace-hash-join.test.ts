/** grace-hash-join.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./grace-hash-join";
import type { VisualFrame } from "@/types";

type Row = { key: number; label: string };

/** Nested-loop equi-join used as the reference answer. */
function bruteForce(left: Row[], right: Row[]): string[][] {
    const out: string[][] = [];
    for (const l of left) {
        for (const r of right) {
            if (l.key === r.key) out.push([l.label, r.label]);
        }
    }
    return out;
}

const normalize = (pairs: string[][]): string[] =>
    pairs.map((pair) => `${pair[0]}:${pair[1]}`).sort();

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], buckets: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(buckets * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Grace Hash Join", () => {
    it("matches a nested-loop join on the default input", () => {
        const input = mod.defaultInput as { left: Row[]; right: Row[]; buckets: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.buckets);
        const final = frames[frames.length - 1];
        expect(normalize(final?.meta["results"] as string[][])).toEqual(
            normalize(bruteForce(input.left, input.right)),
        );
    });

    it("matches a nested-loop join on randomized inputs and bucket counts", () => {
        let seed = 31337;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 37;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const left = Array.from({ length: trial % 20 }, (_, i) => ({ key: next(), label: `l${i}` }));
            const right = Array.from({ length: trial % 15 }, (_, i) => ({ key: next(), label: `r${i}` }));
            const buckets = 2 + (trial % 7);
            const frames = [...mod.run({ left, right, buckets })];
            checkFrames(frames, buckets);
            const final = frames[frames.length - 1];
            expect(normalize(final?.meta["results"] as string[][])).toEqual(
                normalize(bruteForce(left, right)),
            );
            const counts = final?.meta["counts"] as number[][];
            expect(counts[0]?.reduce((a, b) => a + b, 0)).toBe(left.length);
            expect(counts[1]?.reduce((a, b) => a + b, 0)).toBe(right.length);
        }
    });

    it("emits nothing for disjoint keys and handles empty inputs", () => {
        const frames = [...mod.run({ left: [{ key: 1, label: "a" }], right: [{ key: 2, label: "b" }], buckets: 3 })];
        checkFrames(frames, 3);
        expect(frames[frames.length - 1]?.meta["results"]).toEqual([]);
        const empty = [...mod.run({ left: [], right: [], buckets: 2 })];
        checkFrames(empty, 2);
        expect(empty[empty.length - 1]?.meta["results"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
