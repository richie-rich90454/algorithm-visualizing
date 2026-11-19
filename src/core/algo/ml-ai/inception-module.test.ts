/**
 * inception-module.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./inception-module";
import type { VisualFrame } from "@/types";

interface InceptionInput {
    x: number[];
    w1: number[][]; b1: number[];
    w2: number[][]; b2: number[];
    w3: number[][]; b3: number[];
    w4: number[][]; b4: number[];
}

function affineRelu(w: number[][], b: number[], x: number[]): number[] {
    return w.map((row, index) => {
        let sum = b[index] ?? 0;
        row.forEach((weight, j) => { sum += weight * (x[j] ?? 0); });
        return Math.max(0, sum);
    });
}

function reference(cfg: InceptionInput): number[] {
    return [
        ...affineRelu(cfg.w1, cfg.b1, cfg.x),
        ...affineRelu(cfg.w2, cfg.b2, cfg.x),
        ...affineRelu(cfg.w3, cfg.b3, cfg.x),
        ...affineRelu(cfg.w4, cfg.b4, cfg.x),
    ];
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

describe("Inception module", () => {
    it("matches an independent branch-and-concatenate reference", () => {
        const cfg: InceptionInput = {
            x: [1, 0.5],
            w1: [[0.6, 0.2]], b1: [0.1],
            w2: [[0.3, -0.1], [0.2, 0.5]], b2: [0.05, -0.05],
            w3: [[-0.2, 0.7]], b3: [0.0],
            w4: [[0.5, 0.1], [-0.3, 0.4]], b4: [0.1, 0.0],
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const finalValues = frames[frames.length - 1]?.meta["values"] as number[];
        expect(finalValues.length).toBe(expected.length);
        expected.forEach((value, i) => expect(finalValues[i]).toBeCloseTo(value, 6));
    });

    it("concatenates a channel count equal to the sum of branch widths", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const total = frames.slice(0, 4).reduce((sum, frame) => sum + (frame.meta["channels"] as number), 0);
        const finalChannels = frames[frames.length - 1]?.meta["channels"];
        expect(finalChannels).toBe(total);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
