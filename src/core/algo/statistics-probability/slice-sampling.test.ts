import { describe, expect, it } from "vitest";
import mod from "./slice-sampling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function target(x: number, mean: number, sigma: number): number {
    const z = (x - mean) / sigma;
    return Math.exp(-0.5 * z * z);
}

describe("Slice Sampling", () => {
    it("recovers the target mean and variance over a long deterministic chain", () => {
        const input = { mean: 2, sigma: 0.5, width: 1, iterations: 4000, seed: 11 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const mean = meta?.["sampleMean"] as number;
        const variance = meta?.["sampleVar"] as number;
        expect(mean).toBeGreaterThan(1.85);
        expect(mean).toBeLessThan(2.15);
        expect(variance).toBeGreaterThan(0.18);
        expect(variance).toBeLessThan(0.32);
        expect(meta?.["chain"]).toHaveLength(4000);
    });

    it("accepts only points at or above the drawn slice level", () => {
        const frames = [...mod.run({ mean: 0, sigma: 1, width: 2, iterations: 200, seed: 5 })];
        const meta = frames[frames.length - 1]?.meta;
        const chain = meta?.["chain"] as number[];
        const levels = meta?.["levels"] as number[];
        expect(chain).toHaveLength(levels.length);
        for (let i = 0; i < chain.length; i += 1) {
            expect(target(chain[i] ?? 0, 0, 1) + 1e-6).toBeGreaterThanOrEqual(levels[i] ?? 1);
        }
    });

    it("is deterministic and terminates cleanly", () => {
        const input = { mean: 0, sigma: 1, width: 2, iterations: 40, seed: 3 };
        const first = [...mod.run(input)];
        const second = [...mod.run(input)];
        expect(first[first.length - 1]?.meta["chain"]).toEqual(second[second.length - 1]?.meta["chain"]);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
