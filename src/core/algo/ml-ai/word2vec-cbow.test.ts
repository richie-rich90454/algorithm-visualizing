/**
 * word2vec-cbow.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./word2vec-cbow";
import type { VisualFrame } from "@/types";

function unpack(flat: number[], rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, (_v, i) =>
        Array.from({ length: cols }, (_x, j) => flat[i * cols + j] ?? 0),
    );
}

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / total);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Word2vec CBOW (Forward and Update)", () => {
    it("hidden vector and probabilities match independent recomputation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const dim = Number(final["dim"]);
        const V = (final["vocab"] as string[]).length;
        const W1 = unpack(final["W1"] as number[], V, dim);
        const W2 = unpack(final["W2After"] as number[], V, dim);
        const context = final["contextIndices"] as number[];
        const reportedH = final["h"] as number[];
        const h = Array(dim).fill(0);
        for (const index of context) {
            for (let k = 0; k < dim; k += 1) {
                h[k] = (h[k] ?? 0) + (W1[index]?.[k] ?? 0) / context.length;
            }
        }
        reportedH.forEach((value, index) => expect(value).toBeCloseTo(h[index] ?? 0, 9));
        const logits = W2.map((row) => row.reduce((sum, value, k) => sum + value * (h[k] ?? 0), 0));
        const p = softmax(logits);
        (final["pAfter"] as number[]).forEach((value, index) => {
            expect(value).toBeCloseTo(p[index] ?? 0, 9);
        });
        expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    });

    it("loss matches recomputation and strictly decreases", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const target = Number(final["target"]);
        const pAfter = final["pAfter"] as number[];
        const after = -Math.log(Math.max(pAfter[target] ?? 0, 1e-12));
        expect(Number(final["lossAfter"])).toBeCloseTo(after, 9);
        expect(Number(final["lossAfter"])).toBeLessThan(Number(final["lossBefore"]));
    });

    it("uses only in-range context words from the window", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const context = final["contextIndices"] as number[];
        const target = Number(final["target"]);
        expect(context.length).toBeGreaterThan(0);
        context.forEach((index) => expect(index).not.toBe(target));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
