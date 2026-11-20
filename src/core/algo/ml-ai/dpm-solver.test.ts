/**
 * dpm-solver.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dpm-solver";
import type { VisualFrame } from "@/types";

type Input = { sigmas: number[]; startValue: number; denoised: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DPM-Solver", () => {
    it("matches the exact telescoped ODE solution at every step", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const trajectory: number[] = [];
        let x = input.startValue;
        for (let i = 0; i < input.sigmas.length - 1; i += 1) {
            const sigma = input.sigmas[i] ?? 1;
            const nextSigma = input.sigmas[i + 1] ?? sigma;
            x = input.denoised + (x - input.denoised) * (nextSigma / sigma);
            trajectory.push(Number(x.toFixed(8)));
        }
        const final = frames[frames.length - 1]?.meta;
        const reported = final?.["trajectory"] as number[];
        trajectory.forEach((value, i) => expect(reported[i + 1]).toBeCloseTo(value, 5));
        const closedForm = input.denoised + (input.startValue - input.denoised)
            * ((input.sigmas[input.sigmas.length - 1] ?? 1) / (input.sigmas[0] ?? 1));
        expect(Number(final?.["closedForm"])).toBeCloseTo(closedForm, 5);
        expect(Number(final?.["maxError"])).toBeLessThan(1e-6);
    });

    it("approaches the denoised value as the final sigma shrinks", () => {
        const coarse = [...mod.run({ sigmas: [8, 1], startValue: 3, denoised: 2 })];
        const fine = [...mod.run({ sigmas: [8, 4, 2, 1, 0.1], startValue: 3, denoised: 2 })];
        const c = Number(coarse[coarse.length - 1]?.meta["closedForm"]);
        const f = Number(fine[fine.length - 1]?.meta["closedForm"]);
        expect(Math.abs(f - 2)).toBeLessThan(Math.abs(c - 2));
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
