/** supervised-contrastive.test.ts - Brute-force loss, batch properties, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { normalizeRows, supConLoss } from "./supervised-contrastive";
import type { VisualFrame } from "@/types";

function referenceLoss(features: number[][], labels: number[], tau: number): number {
    const z = normalizeRows(features);
    let total = 0;
    let anchors = 0;
    for (let i = 0; i < z.length; i += 1) {
        const positives: number[] = [];
        for (let j = 0; j < z.length; j += 1) {
            if (i !== j && labels[j] === labels[i]) positives.push(j);
        }
        if (positives.length === 0) continue;
        let denom = 0;
        for (let j = 0; j < z.length; j += 1) {
            if (j === i) continue;
            let dot = 0;
            for (let k = 0; k < (z[i]?.length ?? 0); k += 1) dot += (z[i]?.[k] ?? 0) * (z[j]?.[k] ?? 0);
            denom += Math.exp(dot / tau);
        }
        let loss = 0;
        positives.forEach((p) => {
            let dot = 0;
            for (let k = 0; k < (z[i]?.length ?? 0); k += 1) dot += (z[i]?.[k] ?? 0) * (z[p]?.[k] ?? 0);
            loss += -Math.log(Math.exp(dot / tau) / denom);
        });
        total += loss / positives.length;
        anchors += 1;
    }
    return anchors === 0 ? 0 : total / anchors;
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

describe("Supervised contrastive loss", () => {
    it("matches an independent brute-force loss computation", () => {
        const input = mod.defaultInput as { features: number[][]; labels: number[]; temperature: number };
        const got = supConLoss(input.features, input.labels, input.temperature);
        expect(got.loss).toBeCloseTo(referenceLoss(input.features, input.labels, input.temperature), 10);
        got.logits.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
    });

    it("identical features give log of the negative count", () => {
        const features = [[1, 0], [1, 0], [1, 0], [1, 0]];
        const { loss } = supConLoss(features, [0, 0, 1, 1], 0.7);
        expect(loss).toBeCloseTo(Math.log(3), 10);
    });

    it("normalization makes row lengths one", () => {
        normalizeRows([[3, 4], [0, 0]]).forEach((row, i) => {
            const len = Math.sqrt(row.reduce((s, v) => s + v * v, 0));
            expect(len).toBeCloseTo(i === 0 ? 1 : 0, 10);
        });
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
