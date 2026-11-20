/** projected-gradient-descent-adversarial.test.ts - Budget and optimality checks. */

import { describe, expect, it } from "vitest";
import mod, {
    linearScore,
    pgdAttack,
    projectToBall,
} from "./projected-gradient-descent-adversarial";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Projected Gradient Descent Adversarial Attack", () => {
    it("reaches the closed-form worst case inside the budget", () => {
        const input = [0.2, -0.4, 0.1, 0.5];
        const weights = [1, -2, 0.5, 1.5];
        const epsilon = 0.3;
        const result = pgdAttack(input, weights, 0, epsilon, 0.1, 12);
        const optimum = input.map((x, i) => x + epsilon * Math.sign(weights[i] ?? 0));
        result.perturbed.forEach((v, i) => expect(v).toBeCloseTo(optimum[i]!, 10));
        expect(result.finalScore).toBeCloseTo(linearScore(optimum, weights, 0), 10);
        result.perturbation.forEach((p) => expect(Math.abs(p)).toBeLessThanOrEqual(epsilon + 1e-12));
    });

    it("score is nondecreasing and projection clips exactly", () => {
        const result = pgdAttack([0, 0], [1, -2], 0, 0.1, 0.05, 8);
        for (let i = 1; i < result.scores.length; i += 1) {
            expect(result.scores[i]!).toBeGreaterThanOrEqual(result.scores[i - 1]! - 1e-12);
        }
        expect(projectToBall([5, -5], [0, 0], 0.25)).toEqual([0.25, -0.25]);
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { input: number[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.input.length);
        const final = frames[frames.length - 1]!;
        expect(final.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
