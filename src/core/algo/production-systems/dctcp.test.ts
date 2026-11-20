/** dctcp.test.ts - Reference controller simulation and monotonicity properties. */

import { describe, expect, it } from "vitest";
import mod from "./dctcp";
import type { VisualFrame } from "@/types";

function reference(cwnd: number, alpha: number, g: number, increase: number, feedback: number[]) {
    const trajectory: number[] = [];
    const alphas: number[] = [];
    for (const f of feedback) {
        alpha = (1 - g) * alpha + g * f;
        cwnd = f > 0 ? Math.max(1, cwnd * (1 - alpha / 2)) : cwnd + increase / cwnd;
        trajectory.push(cwnd);
        alphas.push(alpha);
    }
    return { cwnd, alpha, trajectory, alphas };
}

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("dctcp", () => {
    it("matches an independent controller simulation", () => {
        const input = mod.defaultInput as {
            initialCwnd: number;
            increase: number;
            g: number;
            alpha: number;
            feedback: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.feedback.length);
        const expected = reference(input.initialCwnd, input.alpha, input.g, input.increase, input.feedback);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["cwnd"])).toBeCloseTo(expected.cwnd, 10);
        expect(Number(final?.["alpha"])).toBeCloseTo(expected.alpha, 10);
        const trajectory = final?.["trajectory"] as number[];
        expect(trajectory.length).toBe(expected.trajectory.length);
        for (let i = 0; i < trajectory.length; i += 1) expect(trajectory[i]).toBeCloseTo(expected.trajectory[i] ?? 0, 10);
    });

    it("never increases on a marked sample and always increases on a clean sample", () => {
        const feedback = [0, 0, 0.5, 0.5, 0, 0.1, 0];
        const frames = [...mod.run({ initialCwnd: 10, increase: 1, g: 0.0625, alpha: 0, feedback })];
        const trajectory = frames[frames.length - 1]?.meta["trajectory"] as number[];
        let previous = 10;
        for (let i = 0; i < feedback.length; i += 1) {
            const next = trajectory[i] ?? 0;
            if ((feedback[i] ?? 0) > 0) expect(next).toBeLessThanOrEqual(previous);
            else expect(next).toBeGreaterThan(previous);
            previous = next;
        }
    });

    it("keeps alpha between zero and one", () => {
        const frames = [...mod.run({ feedback: [1, 1, 1, 0, 0, 1] })];
        const alphas = frames[frames.length - 1]?.meta["alphas"] as number[];
        for (const a of alphas) {
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(1);
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
