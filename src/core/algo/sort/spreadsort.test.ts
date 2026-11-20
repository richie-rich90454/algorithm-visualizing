/** spreadsort.test.ts - Brute-force integer sort check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./spreadsort";

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
        expect(f.entities.every((e) => e.type === "bar")).toBe(true);
        f.entities.forEach((e) => expect(Number.isFinite(e.value as number)).toBe(true));
    });
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Spreadsort", () => {
    it("yields well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        assertFrameShape(frames);
    });

    it("sorts random integer arrays against the reference sort", () => {
        const rnd = seeded(13579);
        for (let t = 0; t < 100; t += 1) {
            const n = 1 + Math.floor(rnd() * 40);
            const input = Array.from({ length: n }, () => Math.floor(rnd() * 2000) - 1000);
            const frames = collect(input);
            const result = frames[frames.length - 1]!.entities.map((e) => e.value as number);
            expect([...input].sort((a, b) => a - b)).toEqual(result);
        }
    });

    it("handles duplicates, negatives, all-equal and small inputs", () => {
        const cases = [
            [5, 5, 5],
            [-4, -1, -9, 0, -1],
            [42],
            [],
            [3, 1],
            Array.from({ length: 40 }, () => 7),
        ];
        for (const input of cases) {
            const frames = collect(input);
            assertFrameShape(frames);
            const result = frames[frames.length - 1]!.entities.map((e) => e.value as number);
            expect([...input].sort((a, b) => a - b)).toEqual(result);
        }
    });

    it("reports that work was done for a nontrivial array", () => {
        const last = collect(mod.defaultInput).at(-1)!;
        expect(last.meta.comparisons).toBeGreaterThan(0);
        expect(last.meta.moves).toBeGreaterThan(0);
    });
});
