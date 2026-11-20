/** effective-sample-size.test.ts - Autocorrelation recomputation and bounds. */

import { describe, expect, it } from "vitest";
import mod from "./effective-sample-size";
import type { VisualFrame } from "@/types";

/** Independent autocorrelation computation using a single global variance. */
function referenceRhos(series: number[]): number[] {
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const deviations = series.map((x) => x - mean);
    const denom = deviations.reduce((sum, d) => sum + d * d, 0);
    const result: number[] = [];
    for (let lag = 1; lag < n; lag += 1) {
        let sum = 0;
        for (let t = 0; t < n - lag; t += 1) sum += deviations[t]! * deviations[t + lag]!;
        result.push(sum / denom);
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Effective Sample Size", () => {
    it("recomputes autocorrelations independently and checks tau and ESS", () => {
        const series = Array.from({ length: 80 }, (_, t) =>
            Math.sin((2 * Math.PI * t) / 13) + 0.2 * t / 80);
        const frames = [...mod.run({ series })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const rhos = final["rhos"] as number[];
        const expected = referenceRhos(series);
        expect(rhos.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(rhos[i]!).toBeCloseTo(expected[i]!, 12);
        }
        const pairs = final["pairs"] as number[];
        const tau = 1 + 2 * pairs.reduce((a, b) => a + b, 0);
        expect(Number(final["tau"])).toBeCloseTo(tau, 12);
        expect(Number(final["ess"])).toBeCloseTo(Math.min(series.length, Math.max(1, series.length / tau)), 10);
    });

    it("returns the full chain length for an alternating anticorrelated series", () => {
        const series = Array.from({ length: 64 }, (_, t) => (t % 2 === 0 ? 1 : -1));
        const frames = [...mod.run({ series })];
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["ess"])).toBe(series.length);
        expect(Number(final["tau"])).toBe(1);
        expect(final["pairs"]).toEqual([]);
    });

    it("keeps the effective size within valid bounds for varied inputs", () => {
        const inputs = [
            Array.from({ length: 100 }, (_, t) => Math.cos(t * 0.1)),
            Array.from({ length: 100 }, (_, t) => Math.sin(t * 0.6)),
            Array.from({ length: 100 }, (_, t) => (t * 37 % 101) / 101),
        ];
        for (const series of inputs) {
            const frames = [...mod.run({ series })];
            const final = frames[frames.length - 1]!.meta;
            const ess = Number(final["ess"]);
            expect(ess).toBeGreaterThanOrEqual(1);
            expect(ess).toBeLessThanOrEqual(series.length);
            expect(Number.isFinite(ess)).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
