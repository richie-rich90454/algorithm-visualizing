import { describe, expect, it } from "vitest";
import mod from "./dirichlet-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dirichlet Distribution", () => {
    it("matches the closed-form moments, posterior, and simplex property", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const alphas = meta?.["alphas"] as number[];
        const means = meta?.["mean"] as number[];
        const variances = meta?.["variance"] as number[];
        const posterior = meta?.["posterior"] as number[];
        const counts = meta?.["counts"] as number[];
        const sample = meta?.["sample"] as number[];
        const alpha0 = alphas.reduce((sum, value) => sum + value, 0);

        for (let i = 0; i < alphas.length; i += 1) {
            expect(means[i]).toBeCloseTo((alphas[i] ?? 0) / alpha0, 10);
            expect(variances[i]).toBeCloseTo(
                ((alphas[i] ?? 0) * (alpha0 - (alphas[i] ?? 0))) / (alpha0 * alpha0 * (alpha0 + 1)),
                10,
            );
            expect(posterior[i]).toBe((alphas[i] ?? 0) + (counts[i] ?? 0));
            expect(sample[i]).toBeGreaterThanOrEqual(0);
        }
        expect(sample.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
        expect(meta?.["sampleSum"]).toBeCloseTo(1, 10);
    });

    it("is deterministic for a seed and concentrates around the mean for large alpha", () => {
        const first = [...mod.run({ alphas: [2, 3, 5], seed: 7 })];
        const second = [...mod.run({ alphas: [2, 3, 5], seed: 7 })];
        const third = [...mod.run({ alphas: [2, 3, 5], seed: 99 })];
        const sampleOf = (frames: VisualFrame[]) => (frames[frames.length - 1]?.meta["sample"] as number[]);
        expect(sampleOf(first)).toEqual(sampleOf(second));
        expect(sampleOf(first)).not.toEqual(sampleOf(third));

        const concentrated = [...mod.run({ alphas: [50, 50], seed: 3 })];
        const values = sampleOf(concentrated);
        for (const value of values) {
            expect(value).toBeGreaterThan(0.35);
            expect(value).toBeLessThan(0.65);
        }
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
