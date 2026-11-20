/**
 * dp-sgd.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dp-sgd";
import type { VisualFrame } from "@/types";

type Vec = [number, number];

function clip(g: Vec, limit: number): Vec {
    const norm = Math.hypot(g[0], g[1]);
    if (norm <= limit || norm === 0) return [g[0], g[1]];
    const scale = limit / norm;
    return [g[0] * scale, g[1] * scale];
}

function reference(batches: Vec[][], clipNorm: number, noiseStd: number, noises: Vec[], lr: number, initial: Vec) {
    let x = initial[0];
    let y = initial[1];
    let maxClippedNorm = 0;
    for (let b = 0; b < batches.length; b += 1) {
        let sx = 0;
        let sy = 0;
        for (const gradient of batches[b]) {
            const c = clip(gradient, clipNorm);
            maxClippedNorm = Math.max(maxClippedNorm, Math.hypot(c[0], c[1]));
            sx += c[0];
            sy += c[1];
        }
        const noise = noises[b] ?? [0, 0];
        const nx = noise[0] * noiseStd * clipNorm;
        const ny = noise[1] * noiseStd * clipNorm;
        const size = Math.max(1, batches[b].length);
        x -= lr * ((sx + nx) / size);
        y -= lr * ((sy + ny) / size);
    }
    return { x, y, maxClippedNorm };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Differentially private SGD", () => {
    it("matches an independent reference for the final parameter", () => {
        const input = mod.defaultInput as {
            batches: Vec[][]; clipNorm: number; noiseStd: number; noises: Vec[]; learningRate: number; initial: Vec;
        };
        const frames = [...mod.run(input)] as VisualFrame[];
        checkFrames(frames, input.batches.length);
        const expected = reference(input.batches, input.clipNorm, input.noiseStd, input.noises, input.learningRate, input.initial);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["finalX"])).toBeCloseTo(expected.x, 10);
        expect(Number(finalMeta?.["finalY"])).toBeCloseTo(expected.y, 10);
        expect(Number(finalMeta?.["maxClippedNorm"])).toBeLessThanOrEqual(input.clipNorm + 1e-9);
        expect(Number(finalMeta?.["steps"])).toBe(input.batches.length);
        const xTrace = finalMeta?.["parameterX"] as number[];
        const yTrace = finalMeta?.["parameterY"] as number[];
        expect(xTrace).toHaveLength(input.batches.length);
        expect(yTrace).toHaveLength(input.batches.length);
    });

    it("reduces to plain SGD when noise is zero", () => {
        const input = {
            batches: [[[1, 2], [3, 4]]],
            clipNorm: 10,
            noiseStd: 0,
            noises: [[0, 0]],
            learningRate: 0.5,
            initial: [0, 0] as Vec,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 1);
        const finalMeta = frames[frames.length - 1]?.meta;
        // Mean gradient is (2,3); parameter moves to (-1,-1.5).
        expect(Number(finalMeta?.["finalX"])).toBeCloseTo(-1, 10);
        expect(Number(finalMeta?.["finalY"])).toBeCloseTo(-1.5, 10);
    });

    it("clips a large gradient to the threshold", () => {
        const input = {
            batches: [[[3, 4]]],
            clipNorm: 2,
            noiseStd: 0,
            noises: [[0, 0]],
            learningRate: 1,
            initial: [0, 0] as Vec,
        };
        const frames = [...mod.run(input)];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["maxClippedNorm"])).toBeCloseTo(2, 10);
        expect(Number(finalMeta?.["finalX"])).toBeCloseTo(-1.2, 10);
        expect(Number(finalMeta?.["finalY"])).toBeCloseTo(-1.6, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
