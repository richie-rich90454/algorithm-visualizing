/**
 * zipf-distribution.test.ts - Independent harmonic reference, normalization,
 * monotonicity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./zipf-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], N: number): void {
    expect(frames.length).toBe(N + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(N);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["N"]).toBe(N);
    });
}

describe("ZipfDistribution", () => {
    it("matches an independent harmonic-sum mass function", () => {
        for (const [N, s] of [[10, 1], [8, 1.5], [6, 0.5]]) {
            const frames = [...mod.run({ N, s })];
            checkFrames(frames, N);
            let harmonic = 0;
            for (let k = 1; k <= N; k += 1) harmonic += Math.pow(k, -s);
            const meta = frames[frames.length - 1]!.meta;
            const pmf = meta["pmf"] as number[];
            const cdf = meta["cdf"] as number[];
            let cumulative = 0;
            let mean = 0;
            expect(Number(meta["harmonic"])).toBeCloseTo(harmonic, 12);
            for (let k = 1; k <= N; k += 1) {
                const mass = Math.pow(k, -s) / harmonic;
                cumulative += mass;
                mean += k * mass;
                expect(pmf[k - 1]).toBeCloseTo(mass, 12);
                expect(cdf[k - 1]).toBeCloseTo(cumulative, 12);
            }
            expect(Number(meta["massSum"])).toBeCloseTo(1, 12);
            expect(cdf.at(-1)).toBeCloseTo(1, 12);
            expect(Number(meta["mean"])).toBeCloseTo(mean, 12);
        }
    });

    it("has decreasing masses for a positive exponent and uniform masses at zero", () => {
        const decreasing = [...mod.run({ N: 12, s: 1.2 })].at(-1)!.meta["pmf"] as number[];
        for (let i = 1; i < decreasing.length; i += 1) {
            expect(decreasing[i]!).toBeLessThanOrEqual(decreasing[i - 1]!);
        }
        const uniform = [...mod.run({ N: 8, s: 0 })].at(-1)!.meta["pmf"] as number[];
        for (const mass of uniform) expect(mass).toBeCloseTo(1 / 8, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
