/**
 * hidden-subgroup-problem.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hidden-subgroup-problem";
import type { VisualFrame } from "@/types";

/** Independent exact Fourier probabilities via a direct DFT over all elements. */
function directProbabilities(n: number, k: number, y: number): number[] {
    const d = n / k;
    const scale = 1 / Math.sqrt(n * d);
    const out: number[] = [];
    for (let j = 0; j < n; j += 1) {
        let re = 0;
        let im = 0;
        for (let x = 0; x < n; x += 1) {
            if ((x - y + n) % k !== 0) {
                continue;
            }
            const angle = (2 * Math.PI * j * x) / n;
            re += Math.cos(angle);
            im += Math.sin(angle);
        }
        out.push((re * scale) ** 2 + (im * scale) ** 2);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

describe("Hidden Subgroup Problem (Cyclic)", () => {
    it("recovers the generator for several subgroups of Z_8 and Z_16", () => {
        for (const [n, k] of [
            [8, 2],
            [8, 4],
            [8, 8],
            [16, 2],
            [16, 4],
            [16, 8],
        ]) {
            const frames = [...mod.run({ n, k, y: 1 })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["recoveredK"]).toBe(k);
            expect(final?.["correct"]).toBe(1);
            const subgroup = (final?.["subgroup"] as string).split(",").map(Number);
            expect(subgroup).toEqual(Array.from({ length: n / k }, (_, m) => (m * k) % n));
        }
    });

    it("matches a direct DFT and keeps support on the dual subgroup", () => {
        const n = 8;
        const k = 2;
        const d = n / k;
        const frames = [...mod.run({ n, k, y: 0 })];
        checkFrames(frames, n);
        const measured = (frames[3]?.entities ?? []).map((e) => Number(e.value));
        const expected = directProbabilities(n, k, 0);
        measured.forEach((value, j) => {
            expect(value).toBeCloseTo(expected[j] ?? 0, 10);
            expect(value > 1e-9 ? j % d === 0 : true).toBe(true);
        });
        expect(measured.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
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
