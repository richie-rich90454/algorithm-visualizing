/**
 * densenet.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./densenet";
import type { VisualFrame } from "@/types";

interface DenseInput {
    x0: number[];
    weights: number[][];
    biases: number[];
}

function reference(cfg: DenseInput): number[] {
    const features = cfg.x0.slice();
    cfg.weights.forEach((weight, layer) => {
        let sum = cfg.biases[layer] ?? 0;
        features.forEach((value, index) => {
            sum += (weight[index] ?? 0) * value;
        });
        features.push(Math.max(0, sum));
    });
    return features;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DenseNet dense block", () => {
    it("matches an independent reference and grows channels linearly", () => {
        const cfg: DenseInput = {
            x0: [0.5, -0.3],
            weights: [[0.4, -0.2], [0.2, 0.5, -0.1], [-0.3, 0.7, 0.2, 0.6]],
            biases: [0.1, -0.05, 0.05],
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const finalValues = frames[frames.length - 1]?.meta["values"] as number[];
        expect(finalValues.length).toBe(cfg.x0.length + cfg.weights.length);
        expected.forEach((value, i) => expect(finalValues[i]).toBeCloseTo(value, 6));
    });

    it("grows by exactly one channel per frame after the input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (let i = 1; i < frames.length; i += 1) {
            const previous = frames[i - 1]?.meta["channels"] as number;
            const current = frames[i]?.meta["channels"] as number;
            expect(current).toBe(previous + 1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
