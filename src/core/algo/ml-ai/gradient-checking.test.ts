/** gradient-checking.test.ts - Numerical reference, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod, {
    analyticGradient,
    checkFunction,
    numericalGradient,
    relativeError,
} from "./gradient-checking";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gradient Checking", () => {
    it("analytic gradient matches a brute-force finite difference", () => {
        const weights = [0.2, -0.7, 1.1, 0.4, -1.3];
        const targets = [1, 0, -1, 0.5, 2];
        const analytic = analyticGradient(weights, targets);
        const numeric = numericalGradient(weights, targets, 1e-5);
        const errors = relativeError(analytic, numeric);
        errors.forEach((e) => expect(e).toBeLessThan(1e-4));
    });

    it("objective equals its explicit summation", () => {
        const weights = [0.2, -0.7, 1.1];
        const targets = [1, 0, -1];
        const expected = weights.reduce(
            (s, w, i) => s + 0.5 * (w - (targets[i] ?? 0)) ** 2 + Math.sin(w),
            0,
        );
        expect(checkFunction(weights, targets)).toBeCloseTo(expected, 12);
    });

    it("rejects a deliberately corrupted gradient", () => {
        const weights = [0.3, -1.2];
        const targets = [1, 0.5];
        const numeric = numericalGradient(weights, targets, 1e-5);
        const broken = analyticGradient(weights, targets).map((g) => g + 0.5);
        const errors = relativeError(broken, numeric);
        expect(Math.max(...errors)).toBeGreaterThan(0.1);
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { weights: number[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.weights.length);
        expect(frames[frames.length - 1]!.meta["passed"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
