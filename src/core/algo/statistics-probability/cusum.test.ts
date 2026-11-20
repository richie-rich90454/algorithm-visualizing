/** cusum.test.ts - brute-force signal detection, stable-series property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./cusum";
import type { VisualFrame } from "@/types";

function referenceSignals(series: number[], target: number, k: number, h: number): number[] {
    let hi = 0, lo = 0;
    const out: number[] = [];
    series.forEach((x, i) => {
        hi = Math.max(0, hi + (x - target - k));
        lo = Math.min(0, lo + (x - target + k));
        if (hi > h || lo < -h) {
            out.push(i);
            hi = 0;
            lo = 0;
        }
    });
    return out;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CUSUM Control Chart", () => {
    it("matches a brute-force two-sided CUSUM scan", () => {
        const cases = [
            { series: [0, 0, 0, 0, 0, 2.5, 2.5, 2.5], target: 0, k: 0.5, h: 2 },
            { series: [1, 1, 1, -1, -1, -1, -1, -1], target: 0, k: 0.4, h: 1.5 },
            { series: [3, 2, 4, 3, 2, 3, 4, 3, 2], target: 3, k: 0.5, h: 1 },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames, c.series.length);
            expect(frames.at(-1)?.meta["signals"]).toEqual(referenceSignals(c.series, c.target, c.k, c.h));
        }
    });

    it("stays quiet under a stable process and signals a sustained shift", () => {
        const stable = [...mod.run({ series: [0, 0, 0, 0, 0, 0, 0, 0], target: 0, k: 0.5, h: 2 })].at(-1)?.meta;
        expect((stable?.["signals"] as number[]).length).toBe(0);
        const shifted = [...mod.run({ series: [0, 0, 0, 0, 3, 3, 3, 3], target: 0, k: 0.5, h: 2 })].at(-1)?.meta;
        expect((shifted?.["signals"] as number[]).length).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
