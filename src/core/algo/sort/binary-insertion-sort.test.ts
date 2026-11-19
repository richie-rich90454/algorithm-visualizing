/** binary-insertion-sort.test.ts - Brute-force correctness, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./binary-insertion-sort";

function collect(input: unknown) {
    return [...mod.run(input)];
}

function assertFrameShape(frames: ReturnType<typeof collect>): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((f, index) => {
        expect(f.stepNumber).toBe(index);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.layout).toBe("array");
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(f.meta).toBeDefined();
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.entities.length).toBeGreaterThan(0);
        f.entities.forEach((e) => {
            expect(e.type).toBe("bar");
            expect(e.id).toBeTruthy();
            expect(typeof e.label).toBe("string");
            expect(Number.isFinite(e.value as number)).toBe(true);
        });
    });
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("BinaryInsertionSort", () => {
    it("produces well-formed frames on the default input and terminates", () => {
        const frames = collect(mod.defaultInput);
        assertFrameShape(frames);
        const last = frames[frames.length - 1]!;
        expect(last.meta.comparisons).toBeGreaterThan(0);
        expect(last.meta.shifts).toBeGreaterThanOrEqual(0);
    });

    it("sorts random arrays with duplicates (brute-force cross-check)", () => {
        const rnd = seeded(12345);
        for (let t = 0; t < 120; t += 1) {
            const n = 1 + Math.floor(rnd() * 14);
            const input = Array.from({ length: n }, () => Math.floor(rnd() * 11) - 5);
            const frames = collect(input);
            const result = frames[frames.length - 1]!.entities.map((e) => e.value as number);
            expect([...input].sort((a, b) => a - b)).toEqual(result);
        }
    });

    it("uses at most a logarithmic number of comparisons per insertion", () => {
        const rnd = seeded(777);
        for (let t = 0; t < 30; t += 1) {
            const n = 2 + Math.floor(rnd() * 12);
            const input = Array.from({ length: n }, () => Math.floor(rnd() * 20));
            const frames = collect(input);
            const comparisons = frames[frames.length - 1]!.meta.comparisons as number;
            let bound = 0;
            for (let i = 1; i < n; i += 1) bound += Math.floor(Math.log2(i)) + 2;
            expect(comparisons).toBeLessThanOrEqual(bound);
        }
    });

    it("handles an empty array and a single element", () => {
        expect(collect([])[0]!.entities).toHaveLength(0);
        const one = collect([42]);
        expect(one[one.length - 1]!.entities[0]!.value).toBe(42);
    });
});
