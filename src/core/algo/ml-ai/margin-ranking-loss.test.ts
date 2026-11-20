/** margin-ranking-loss.test.ts - Brute-force hinge and mean checks. */

import { describe, expect, it } from "vitest";
import mod from "./margin-ranking-loss";
import type { VisualFrame } from "@/types";

interface Pair {
    x1: number;
    x2: number;
    y: number;
}
interface Input {
    pairs: Pair[];
    margin: number;
}

function reference(input: Input) {
    const scores = input.pairs.map((p) => p.y * (p.x1 - p.x2));
    const losses = scores.map((s) => Math.max(0, input.margin - s));
    const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
    const correct = scores.filter((s) => s >= input.margin).length;
    return { scores, losses, mean, correct };
}

function checkFrames(frames: VisualFrame[], pairs: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * pairs);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Margin ranking loss", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent pairwise hinge computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.pairs.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const scores = final?.["scores"] as number[];
        const losses = final?.["losses"] as number[];
        scores.forEach((value, i) => expect(value).toBeCloseTo(expected.scores[i] ?? 0, 9));
        losses.forEach((value, i) => expect(value).toBeCloseTo(expected.losses[i] ?? 0, 9));
        expect(Number(final?.["meanLoss"])).toBeCloseTo(expected.mean, 9);
        expect(final?.["correct"]).toBe(expected.correct);
    });

    it("gives zero loss on perfectly ordered pairs", () => {
        const easy: Input = {
            pairs: [
                { x1: 1, x2: 0, y: 1 },
                { x1: 0, x2: 1, y: -1 },
            ],
            margin: 0.5,
        };
        const frames = [...mod.run(easy)];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["meanLoss"])).toBe(0);
        expect(final?.["correct"]).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
