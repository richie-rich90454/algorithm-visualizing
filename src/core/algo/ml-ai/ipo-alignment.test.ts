/** ipo-alignment.test.ts - Independent logistic-loss reference, monotonicity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { ipoLoss, softplus } from "./ipo-alignment";
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

describe("IPO Alignment", () => {
    it("matches an independent softplus logistic reference", () => {
        for (const [c, r, b] of [[0.8, 0.1, 1], [-1, 2, 0.5], [0, 0, 2], [3, -2, 1.5]]) {
            const margin = b * (c - r);
            const p = 1 / (1 + Math.exp(-margin));
            const expected = -Math.log(p);
            expect(softplus(-margin)).toBeCloseTo(expected, 10);
            const got = ipoLoss(c, r, b);
            expect(got.margin).toBeCloseTo(margin, 12);
            expect(got.loss).toBeCloseTo(expected, 10);
        }
    });

    it("a zero margin gives log two and larger chosen ratios lower the loss", () => {
        expect(ipoLoss(0, 0, 1).loss).toBeCloseTo(Math.LN2, 10);
        let previous = Infinity;
        for (let chosen = -2; chosen <= 3; chosen += 0.5) {
            const loss = ipoLoss(chosen, 0, 1).loss;
            expect(loss).toBeLessThanOrEqual(previous + 1e-12);
            previous = loss;
        }
    });

    it("emits well-formed frames matching the reference", () => {
        const input = mod.defaultInput as { chosenLogRatio: number; rejectedLogRatio: number; beta: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = ipoLoss(input.chosenLogRatio, input.rejectedLogRatio, input.beta);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["margin"]).toBeCloseTo(expected.margin, 10);
        expect(final?.["loss"]).toBeCloseTo(expected.loss, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
