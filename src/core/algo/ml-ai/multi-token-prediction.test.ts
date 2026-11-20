/** multi-token-prediction.test.ts - Brute-force cross-entropy, optimality, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { crossEntropy, mtpLoss, softmax } from "./multi-token-prediction";
import type { VisualFrame } from "@/types";

interface Input {
    logits: number[][];
    targets: number[];
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Multi-token prediction", () => {
    it("cross-entropy matches an independent brute-force softmax", () => {
        const cases: Array<[number[], number]> = [
            [[2, 0.5, -1], 0],
            [[1, 3, 0], 1],
            [[0, 1, 4], 2],
            [[0, 0, 0], 2],
        ];
        for (const [logits, target] of cases) {
            const exps = logits.map((v) => Math.exp(v));
            const sum = exps.reduce((a, b) => a + b, 0);
            const p = exps[target]! / sum;
            expect(close(crossEntropy(logits, target), -Math.log(p))).toBe(true);
        }
    });

    it("per-head losses and mean follow the objective", () => {
        const logits = [[2, 0.5, -1], [1, 3, 0], [0, 1, 4]];
        const targets = [0, 1, 2];
        const { perHead, mean } = mtpLoss(logits, targets);
        const expected = logits.map((l, k) => crossEntropy(l, targets[k]!));
        perHead.forEach((v, i) => expect(close(v, expected[i]!)).toBe(true));
        expect(close(mean, expected.reduce((a, b) => a + b, 0) / expected.length)).toBe(true);
        expect(mean).toBeGreaterThanOrEqual(0);
    });

    it("a head that favors its target has near-zero loss", () => {
        expect(crossEntropy([10, 0, 0], 0)).toBeLessThan(0.001);
        expect(crossEntropy([0, 0, 0], 1)).toBeCloseTo(Math.log(3), 6);
        expect(softmax([0, 0]).every((v) => close(v, 0.5))).toBe(true);
        expect(mtpLoss([], []).mean).toBe(0);
    });

    it("matches the losses through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = mtpLoss(input.logits, input.targets);
        const final = frames[frames.length - 1]?.meta;
        const perHead = final?.["perHead"] as number[];
        perHead.forEach((v, i) => expect(close(v, expected.perHead[i]!)).toBe(true));
        expect(close(final?.["mean"] as number, expected.mean)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
