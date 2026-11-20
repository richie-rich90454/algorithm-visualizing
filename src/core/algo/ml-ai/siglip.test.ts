/** siglip.test.ts - Sigmoid pair loss correctness, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./siglip";
import type { VisualFrame } from "@/types";

interface Input {
    images: number[][];
    texts: number[][];
    bias: number;
    logScale: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeDefined();
    });
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function softplus(x: number): number {
    return x > 20 ? x : Math.log1p(Math.exp(x));
}

function reference(input: Input) {
    const scale = Math.exp(input.logScale);
    const logits: number[][] = [];
    const losses: number[][] = [];
    input.images.forEach((image, i) => {
        const logitRow: number[] = [];
        const lossRow: number[] = [];
        input.texts.forEach((text, j) => {
            const logit = scale * dot(image, text) + input.bias;
            logitRow.push(logit);
            lossRow.push(softplus(-(i === j ? 1 : -1) * logit));
        });
        logits.push(logitRow);
        losses.push(lossRow);
    });
    const total = losses.flat().reduce((a, v) => a + v, 0);
    return { logits, losses, loss: total / (input.images.length * input.texts.length) };
}

describe("Sigmoid Language-Image Pretraining", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent sigmoid pair loss computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["loss"])).toBeCloseTo(expected.loss, 10);
        (final["logits"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo(expected.logits.flat()[i]!, 10),
        );
        (final["pairLosses"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo(expected.losses.flat()[i]!, 10),
        );
    });

    it("gives every pair a loss of log two when the logit is zero", () => {
        const frames = [...mod.run({ ...input, images: [[1, 0]], texts: [[0, 1]], bias: 0, logScale: -100 })];
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["loss"])).toBeCloseTo(Math.log(2), 8);
        expect((final["logits"] as number[])[0]!).toBeCloseTo(0, 8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
