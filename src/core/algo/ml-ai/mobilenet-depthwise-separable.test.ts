/**
 * mobilenet-depthwise-separable.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./mobilenet-depthwise-separable";
import type { VisualFrame } from "@/types";

interface MobileInput {
    channels: number[][];
    depthwise: number[][];
    pointwise: number[][];
    bias: number[];
}

function reference(cfg: MobileInput): { depth: number[]; output: number[] } {
    const depth = cfg.channels.map((channel, index) => {
        const kernel = cfg.depthwise[index] ?? [];
        return channel.reduce((sum, value, j) => sum + value * (kernel[j] ?? 0), 0);
    });
    const output = cfg.pointwise.map((row, index) => {
        let sum = cfg.bias[index] ?? 0;
        row.forEach((weight, j) => { sum += weight * (depth[j] ?? 0); });
        return Math.max(0, sum);
    });
    return { depth, output };
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

describe("MobileNet depthwise separable convolution", () => {
    it("matches an independent two-stage reference", () => {
        const cfg: MobileInput = {
            channels: [[1, 2], [3, 0.5]],
            depthwise: [[0.5, -0.2], [0.3, 0.4]],
            pointwise: [[1, -0.5], [0.2, 0.8]],
            bias: [0.1, -0.1],
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const depthValues = frames[1]?.meta["values"] as number[];
        const finalValues = frames[frames.length - 1]?.meta["values"] as number[];
        expect(depthValues.length).toBe(cfg.channels.length);
        expected.depth.forEach((value, i) => expect(depthValues[i]).toBeCloseTo(value, 6));
        expected.output.forEach((value, i) => expect(finalValues[i]).toBeCloseTo(value, 6));
    });

    it("produces identical output on a second configuration", () => {
        const cfg: MobileInput = {
            channels: [[2, 1], [-1, 3]],
            depthwise: [[0.1, 0.9], [0.4, -0.2]],
            pointwise: [[0.7, 0.3], [-0.5, 0.6]],
            bias: [0.0, 0.2],
        };
        const frames = [...mod.run(cfg)];
        const expected = reference(cfg);
        const finalValues = frames[frames.length - 1]?.meta["values"] as number[];
        expected.output.forEach((value, i) => expect(finalValues[i]).toBeCloseTo(value, 6));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
