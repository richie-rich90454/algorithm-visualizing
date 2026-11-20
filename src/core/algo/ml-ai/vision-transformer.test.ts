/**
 * vision-transformer.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./vision-transformer";
import type { VisualFrame } from "@/types";

interface VitInput {
    image: number[];
    gridSize: number;
    patchSize: number;
    projection: number[][];
    bias: number[];
    classToken: number[];
    positions: number[][];
}

function extractPatches(image: number[], grid: number, patch: number): number[][] {
    const patches: number[][] = [];
    for (let row = 0; row < grid; row += patch) {
        for (let col = 0; col < grid; col += patch) {
            const values: number[] = [];
            for (let dy = 0; dy < patch; dy += 1) {
                for (let dx = 0; dx < patch; dx += 1) {
                    values.push(image[(row + dy) * grid + (col + dx)] ?? 0);
                }
            }
            patches.push(values);
        }
    }
    return patches;
}

function reference(cfg: VitInput): { tokens: number[]; tokenCount: number; patchCount: number } {
    const patches = extractPatches(cfg.image, cfg.gridSize, cfg.patchSize);
    const embeddings = patches.map((patch) => cfg.projection[0].map((_, d) => {
        let sum = cfg.bias[d] ?? 0;
        patch.forEach((value, i) => { sum += value * cfg.projection[i][d]; });
        return sum;
    }));
    const tokens = [cfg.classToken, ...embeddings].map((token, index) =>
        token.map((v, d) => v + (cfg.positions[index]?.[d] ?? 0)),
    );
    return { tokens: tokens.flat(), tokenCount: tokens.length, patchCount: patches.length };
}

function fullConfig(): VitInput {
    return {
        image: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        gridSize: 4, patchSize: 2,
        projection: [[0.1, 0, 0.2], [0, 0.3, 0.1], [0.2, 0, 0.1], [0, 0.1, 0.4]],
        bias: [0, 0, 0], classToken: [1, 0, 0],
        positions: [[0.01, 0, 0], [0, 0.01, 0], [0, 0, 0.01], [0.01, 0.01, 0], [0, 0.01, 0.01]],
    };
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

describe("Vision Transformer patch embedding", () => {
    it("matches an independent patch-projection reference", () => {
        const cfg = fullConfig();
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["tokenCount"])).toBe(expected.tokenCount);
        expect(Number(final?.["patches"])).toBe(expected.patchCount);
        const values = final?.["values"] as number[];
        expect(values.length).toBe(expected.tokens.length);
        expected.tokens.forEach((value, i) => expect(values[i]).toBeCloseTo(value, 6));
    });

    it("extracts the expected four patches covering the whole image", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const patchFrame = frames[1];
        const values = patchFrame?.meta["values"] as number[];
        expect(values).toEqual([1, 2, 5, 6, 3, 4, 7, 8, 9, 10, 13, 14, 11, 12, 15, 16]);
        expect(Number(patchFrame?.meta["patches"])).toBe(4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
