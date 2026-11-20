/** euler-ancestral-sampler.test.ts - Forward/reverse inversion, brute-force steps, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { ancestralSample, ancestralStep, forwardDiffuse } from "./euler-ancestral-sampler";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
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

describe("Euler Ancestral Sampler", () => {
    it("inverts forward diffusion when given the true noise", () => {
        const x0 = [2, -1, 0.5];
        const noise = [0.4, -0.3, 0.9];
        const alphas = [1, 0.64, 0.36, 0.16];
        const xT = forwardDiffuse(x0, alphas[alphas.length - 1] ?? 0.16, noise);
        const trajectory = ancestralSample(xT, alphas, noise);
        const recovered = trajectory[trajectory.length - 1] ?? [];
        recovered.forEach((value, i) => expect(value).toBeCloseTo(x0[i] ?? 0, 9));
        expect(trajectory.length).toBe(alphas.length);
    });

    it("matches a brute-force single reverse step", () => {
        const x = [1.2, -0.7];
        const noise = [0.4, -0.3];
        const got = ancestralStep(x, 0.36, 0.16, noise);
        got.forEach((value, i) => {
            const predX0 = ((x[i] ?? 0) - Math.sqrt(1 - 0.36) * (noise[i] ?? 0)) / Math.sqrt(0.36);
            const expected = Math.sqrt(0.16) * predX0 + Math.sqrt(1 - 0.16) * (noise[i] ?? 0);
            expect(value).toBeCloseTo(expected, 12);
        });
    });

    it("emits well-formed frames whose trajectory matches the reference", () => {
        const input = mod.defaultInput as { alphaBars: number[]; xT: number[]; noise: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = ancestralSample(input.xT, input.alphaBars, input.noise);
        const final = frames[frames.length - 1]?.meta["trajectory"] as number[][];
        final.forEach((vec, i) => vec.forEach((v, j) => expect(v).toBeCloseTo(expected[i]?.[j] ?? 0, 10)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
