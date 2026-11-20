/** clip-model.test.ts - Logit matrix, symmetric loss, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { clipLogits, clipLoss } from "./clip-model";
import type { VisualFrame } from "@/types";

function bruteLoss(logits: number[][]): number {
    const n = logits.length;
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        const row = logits[i] ?? [];
        const max = Math.max(...row);
        const denom = row.reduce((s, v) => s + Math.exp(v - max), 0);
        sum += -Math.log(Math.exp(row[i]! - max) / denom);
    }
    for (let j = 0; j < n; j += 1) {
        const col = logits.map((row) => row[j] ?? 0);
        const max = Math.max(...col);
        const denom = col.reduce((s, v) => s + Math.exp(v - max), 0);
        sum += -Math.log(Math.exp(col[j]! - max) / denom);
    }
    return sum / (2 * n);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CLIP model", () => {
    it("logits match scaled cosine similarity", () => {
        const logits = clipLogits([[3, 4], [0, 1]], [[6, 8], [1, 0]], 2);
        expect(logits[0]![0]).toBeCloseTo(2, 10);
        expect(logits[0]![1]).toBeCloseTo(1.2, 10);
    });

    it("loss matches a brute-force symmetric computation", () => {
        const input = mod.defaultInput as { imageEmbeddings: number[][]; textEmbeddings: number[][]; logitScale: number };
        const logits = clipLogits(input.imageEmbeddings, input.textEmbeddings, input.logitScale);
        const { loss } = clipLoss(logits);
        expect(loss).toBeCloseTo(bruteLoss(logits), 10);
    });

    it("orthogonal matched pairs give the analytic loss", () => {
        const logits = clipLogits([[1, 0], [0, 1]], [[1, 0], [0, 1]], 4);
        const { loss } = clipLoss(logits);
        const p = Math.exp(4) / (Math.exp(4) + 1);
        expect(loss).toBeCloseTo(-Math.log(p), 10);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
