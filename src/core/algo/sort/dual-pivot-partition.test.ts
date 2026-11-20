/** dual-pivot-partition.test.ts - Real partition properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dual-pivot-partition";

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
    });
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 0x100000000;
    };
}

describe("DualPivotPartition", () => {
    it("produces well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        assertFrameShape(frames);
    });

    it("forms valid low, middle and high regions (property check)", () => {
        const rnd = seeded(4242);
        for (let t = 0; t < 200; t += 1) {
            const n = 1 + Math.floor(rnd() * 20);
            const input = Array.from({ length: n }, () => Math.floor(rnd() * 15) - 7);
            const frames = collect(input);
            const last = frames[frames.length - 1]!;
            const out = last.entities.map((e) => e.value as number);
            const p = last.meta.p as number;
            const q = last.meta.q as number;
            const low = last.meta.lowPivot as number;
            const high = last.meta.highPivot as number;

            expect(out[low]).toBe(p);
            expect(out[high]).toBe(q);
            for (let k = 0; k < low; k += 1) expect(out[k]!).toBeLessThan(p);
            for (let k = low + 1; k < high; k += 1) {
                expect(out[k]!).toBeGreaterThanOrEqual(p);
                expect(out[k]!).toBeLessThanOrEqual(q);
            }
            for (let k = high + 1; k < n; k += 1) expect(out[k]!).toBeGreaterThan(q);
            expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
        }
    });

    it("handles duplicate pivots and already ordered endpoints", () => {
        for (const input of [[5, 5, 5, 5], [1, 9], [9, 1], [2, 2, 1, 1, 3, 3]]) {
            const frames = collect(input);
            assertFrameShape(frames);
            const last = frames[frames.length - 1]!;
            expect([...last.entities.map((e) => e.value as number)].sort((a, b) => a - b)).toEqual(
                [...input].sort((a, b) => a - b),
            );
        }
    });

    it("reports region counts that sum correctly", () => {
        const frames = collect(mod.defaultInput);
        const m = frames[frames.length - 1]!.meta;
        const total = (m.lessCount as number) + (m.middleCount as number) + (m.greaterCount as number) + 2;
        expect(total).toBe((mod.defaultInput as number[]).length);
    });
});
