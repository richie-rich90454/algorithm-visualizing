/** cox-proportional-hazards.test.ts - Independent Newton cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cox-proportional-hazards";
import type { VisualFrame } from "@/types";

interface Subject {
    time: number;
    event: number;
    x: number;
}

/** Brute-force score, information and log-likelihood recomputed from the definition. */
function referenceEvaluate(subjects: Subject[], beta: number) {
    const times = [...new Set(subjects.map((s) => s.time))].sort((a, b) => a - b);
    let score = 0;
    let info = 0;
    let logLik = 0;
    for (const t of times) {
        const failures = subjects.filter((s) => s.time === t && s.event === 1);
        if (failures.length === 0) continue;
        const risk = subjects.filter((s) => s.time >= t);
        const expo = risk.map((s) => Math.exp(beta * s.x));
        const s0 = expo.reduce((a, b) => a + b, 0);
        const s1 = risk.reduce((sum, s, i) => sum + s.x * (expo[i] ?? 0), 0);
        const s2 = risk.reduce((sum, s, i) => sum + s.x * s.x * (expo[i] ?? 0), 0);
        const m = s1 / s0;
        score += failures.reduce((sum, f) => sum + f.x, 0) - failures.length * m;
        info += failures.length * (s2 / s0 - m * m);
        logLik += failures.reduce((sum, f) => sum + beta * f.x, 0) - failures.length * Math.log(s0);
    }
    return { score, info, logLik };
}

function referenceBeta(subjects: Subject[], maxIterations = 25): number {
    let beta = 0;
    for (let k = 0; k < maxIterations; k += 1) {
        const { score, info } = referenceEvaluate(subjects, beta);
        if (Math.abs(score) < 1e-9 || info <= 0) break;
        beta += score / info;
    }
    return beta;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cox Proportional Hazards", () => {
    it("matches an independent Newton fit on several datasets", () => {
        const datasets: Subject[][] = [
            [
                { time: 1, event: 1, x: 0 }, { time: 2, event: 1, x: 1 },
                { time: 3, event: 0, x: 0 }, { time: 4, event: 1, x: 1 },
                { time: 5, event: 1, x: 1 }, { time: 6, event: 0, x: 0 },
                { time: 7, event: 1, x: 0 },
            ],
            [
                { time: 1, event: 1, x: 2 }, { time: 2, event: 1, x: 1 },
                { time: 2, event: 1, x: 0 }, { time: 3, event: 0, x: 2 },
                { time: 4, event: 1, x: 0 }, { time: 5, event: 1, x: 1 },
            ],
            [
                { time: 1, event: 1, x: -1 }, { time: 2, event: 1, x: 0 },
                { time: 3, event: 1, x: 1 }, { time: 4, event: 0, x: -1 },
                { time: 5, event: 1, x: 1 },
            ],
        ];
        for (const subjects of datasets) {
            const frames = [...mod.run({ subjects })];
            checkFrames(frames, subjects.length);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["beta"])).toBeCloseTo(referenceBeta(subjects), 8);
            expect(Number(final?.["score"])).toBeLessThan(1e-6);
            expect(final?.["converged"]).toBe(true);
        }
    });

    it("increases the partial likelihood monotonically during fitting", () => {
        const subjects = [
            { time: 1, event: 1, x: 0 }, { time: 2, event: 1, x: 1 },
            { time: 3, event: 0, x: 0 }, { time: 4, event: 1, x: 1 },
            { time: 5, event: 1, x: 1 }, { time: 6, event: 0, x: 0 },
            { time: 7, event: 1, x: 0 },
        ];
        const logLiks = [...mod.run({ subjects })].map((f) => Number(f.meta["logLik"]));
        for (let i = 1; i < logLiks.length; i += 1) {
            expect(logLiks[i] as number).toBeGreaterThanOrEqual((logLiks[i - 1] as number) - 1e-9);
        }
    });

    it("reports a hazard ratio consistent with the fitted coefficient", () => {
        const final = [...mod.run(mod.defaultInput)].at(-1)?.meta;
        const beta = Number(final?.["beta"]);
        expect(Number(final?.["hazardRatio"])).toBeCloseTo(Math.exp(beta), 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
