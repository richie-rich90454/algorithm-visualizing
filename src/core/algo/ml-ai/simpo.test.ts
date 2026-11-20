/** simpo.test.ts - Independent SimPO reference, length normalization, monotonicity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./simpo";
import type { VisualFrame } from "@/types";

interface Input {
    chosenLogp: number[];
    rejectedLogp: number[];
    chosenLengths: number[];
    rejectedLengths: number[];
    beta: number;
    gamma: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

const sigmoid = (v: number): number => (v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v)));

function one(
    chosen: number,
    rejected: number,
    chosenLength: number,
    rejectedLength: number,
    beta: number,
    gamma: number,
) {
    const c = (beta / Math.max(1, chosenLength)) * chosen;
    const r = (beta / Math.max(1, rejectedLength)) * rejected;
    const margin = c - r - gamma;
    return { margin, loss: -Math.log(Math.max(1e-12, sigmoid(margin))) };
}

function reference(input: Input) {
    const pairs = input.chosenLogp.map((_, i) =>
        one(
            input.chosenLogp[i]!,
            input.rejectedLogp[i]!,
            input.chosenLengths[i]!,
            input.rejectedLengths[i]!,
            input.beta,
            input.gamma,
        ),
    );
    return { pairs, mean: pairs.reduce((s, p) => s + p.loss, 0) / pairs.length };
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

describe("SimPO loss", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const losses = frames[frames.length - 1]?.meta["loss"] as number[];
        const mean = frames[frames.length - 1]?.meta["mean"] as number;
        losses.forEach((v, i) => expect(close(v, expected.pairs[i]!.loss)).toBe(true));
        expect(close(mean, expected.mean)).toBe(true);
    });

    it("normalizes by length so longer responses are not rewarded for length", () => {
        const short = one(-1, -2, 1, 1, 2, 0.5);
        const long = one(-1, -2, 20, 20, 2, 0.5);
        expect(Math.abs(short.margin)).toBeGreaterThan(Math.abs(long.margin));
        expect(long.margin).toBeCloseTo((2 / 20) * -1 - (2 / 20) * -2 - 0.5, 9);
    });

    it("lowers loss when the chosen reward improves and raises it when the rejected improves", () => {
        const base = one(-0.3, -1.8, 8, 12, 2, 0.5);
        const betterChosen = one(0.5, -1.8, 8, 12, 2, 0.5);
        const betterRejected = one(-0.3, -0.2, 8, 12, 2, 0.5);
        expect(betterChosen.loss).toBeLessThan(base.loss);
        expect(betterRejected.loss).toBeGreaterThan(base.loss);
    });

    it("matches the reference on a second batch and terminates cleanly", () => {
        const input: Input = {
            chosenLogp: [0.4, -0.2, -1.5, -0.9],
            rejectedLogp: [-1.1, -2.2, -0.5, -1.3],
            chosenLengths: [4, 10, 16, 7],
            rejectedLengths: [9, 6, 20, 12],
            beta: 1.4,
            gamma: 0.8,
        };
        const expected = reference(input);
        const generator = mod.run(input);
        let count = 0;
        let last: VisualFrame | undefined;
        for (const frame of generator) {
            last = frame;
            count += 1;
        }
        expect(count).toBe(input.chosenLogp.length + 2);
        expect(generator.next().done).toBe(true);
        const losses = last?.meta["loss"] as number[];
        losses.forEach((v, i) => expect(close(v, expected.pairs[i]!.loss)).toBe(true));
        expect(close(last?.meta["mean"] as number, expected.mean)).toBe(true);
    });
});
