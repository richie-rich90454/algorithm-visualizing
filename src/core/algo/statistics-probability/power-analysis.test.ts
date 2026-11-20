/** power-analysis.test.ts - null power, monotone curve, reference value, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./power-analysis";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], points: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(points);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Statistical Power Analysis", () => {
    it("gives power equal to alpha at zero effect and a known value at a moderate effect", () => {
        const twoSided = [...mod.run({ effectSize: 0.5, n: 64, alpha: 0.05, tails: 2, points: 12 })];
        checkFrames(twoSided, 12);
        const meta = twoSided.at(-1)?.meta;
        const powers = meta?.["powers"] as number[];
        expect(powers[0]).toBeCloseTo(0.05, 6);
        expect(Number(meta?.["zCrit"])).toBeCloseTo(1.959964, 5);
        const delta = 0.5 * Math.sqrt(64);
        const reference = 0.5 * (1 + erfApprox((delta - 1.959964) / Math.SQRT2))
            + 0.5 * (1 + erfApprox((-delta - 1.959964) / Math.SQRT2));
        expect(Number(meta?.["power"])).toBeCloseTo(reference, 5);
    });

    it("has a monotone power curve that grows with sample size", () => {
        const small = [...mod.run({ effectSize: 0.5, n: 16, points: 20 })].at(-1)?.meta;
        const large = [...mod.run({ effectSize: 0.5, n: 100, points: 20 })].at(-1)?.meta;
        expect(Number(large?.["power"])).toBeGreaterThan(Number(small?.["power"]));
        const powers = large?.["powers"] as number[];
        for (let i = 1; i < powers.length; i += 1) expect(powers[i] as number).toBeGreaterThanOrEqual(powers[i - 1] as number);
        const oneSided = [...mod.run({ effectSize: 0.5, n: 64, tails: 1 })].at(-1)?.meta;
        expect(Number(oneSided?.["power"])).toBeGreaterThan(0.5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

function erfApprox(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return sign * y;
}
