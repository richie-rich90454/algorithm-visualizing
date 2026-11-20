/**
 * control-variates.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./control-variates";
import type { VisualFrame } from "@/types";

/** Independent brute-force control-variate computation. */
function reference(uniforms: number[], controlMean: number) {
    const targets = uniforms.map(Math.exp);
    const controls = uniforms.slice();
    const n = uniforms.length;
    const meanT = targets.reduce((s, x) => s + x, 0) / n;
    const meanC = controls.reduce((s, x) => s + x, 0) / n;
    let covariance = 0;
    let controlVariance = 0;
    for (let i = 0; i < n; i += 1) {
        covariance += (targets[i] - meanT) * (controls[i] - meanC);
        controlVariance += (controls[i] - meanC) ** 2;
    }
    covariance /= n;
    controlVariance /= n;
    const coefficient = controlVariance === 0 ? 0 : covariance / controlVariance;
    return { meanT, meanC, coefficient, estimate: meanT - coefficient * (meanC - controlMean) };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Control variates", () => {
    it("matches an independent reference for the optimal coefficient and estimate", () => {
        const cases: Array<{ uniforms: number[]; controlMean: number }> = [
            { uniforms: [0.08, 0.19, 0.31, 0.44, 0.56, 0.69, 0.82, 0.94], controlMean: 0.5 },
            { uniforms: [0.1, 0.2, 0.3, 0.4, 0.5], controlMean: 0.5 },
            { uniforms: [0.02, 0.25, 0.49, 0.75, 0.99], controlMean: 0.5 },
        ];
        for (const { uniforms, controlMean } of cases) {
            const frames = [...mod.run({ uniforms, controlMean })] as VisualFrame[];
            checkFrames(frames, uniforms.length);
            const expected = reference(uniforms, controlMean);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["meanTarget"])).toBeCloseTo(expected.meanT, 10);
            expect(Number(finalMeta?.["meanControl"])).toBeCloseTo(expected.meanC, 10);
            expect(Number(finalMeta?.["coefficient"])).toBeCloseTo(expected.coefficient, 10);
            expect(Number(finalMeta?.["naiveEstimate"])).toBeCloseTo(expected.meanT, 10);
            expect(Number(finalMeta?.["controlledEstimate"])).toBeCloseTo(expected.estimate, 10);
        }
    });

    it("leaves the estimate unchanged when the control mean matches the sample", () => {
        const uniforms = [0.1, 0.3, 0.6, 0.9];
        const controlMean = uniforms.reduce((s, x) => s + x, 0) / uniforms.length;
        const frames = [...mod.run({ uniforms, controlMean })];
        checkFrames(frames, uniforms.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["controlledEstimate"])).toBeCloseTo(Number(finalMeta?.["naiveEstimate"]), 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
