/**
 * swin-transformer.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./swin-transformer";
import type { VisualFrame } from "@/types";

interface SwinInput { grid: number[]; size: number; window: number; }

function partition(grid: number[], size: number, window: number): number[][] {
    const windows: number[][] = [];
    for (let row = 0; row < size; row += window) {
        for (let col = 0; col < size; col += window) {
            const values: number[] = [];
            for (let dy = 0; dy < window; dy += 1) {
                for (let dx = 0; dx < window; dx += 1) values.push(grid[(row + dy) * size + col + dx] ?? 0);
            }
            windows.push(values);
        }
    }
    return windows;
}

function roll(grid: number[], size: number, shift: number): number[] {
    const result = new Array<number>(grid.length);
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            result[row * size + col] = grid[((row - shift + size) % size) * size + ((col - shift + size) % size)] ?? 0;
        }
    }
    return result;
}

function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exps = values.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((v) => v / total);
}

function attention(values: number[]): number[] {
    return values.map((q) => {
        const weights = softmax(values.map((k) => (q * k) / Math.sqrt(values.length)));
        return weights.reduce((sum, w, i) => sum + w * values[i], 0);
    });
}

function reference(cfg: SwinInput) {
    const shift = Math.floor(cfg.window / 2);
    const regular = partition(cfg.grid, cfg.size, cfg.window);
    const shifted = partition(roll(cfg.grid, cfg.size, shift), cfg.size, cfg.window);
    return {
        regularWindows: regular.flat(),
        regularOutput: regular.map(attention).flat(),
        shiftedWindows: shifted.flat(),
        shiftedOutput: shifted.map(attention).flat(),
        windowCount: regular.length,
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

describe("Swin shifted-window attention", () => {
    it("matches an independent partition and attention reference", () => {
        const cfg: SwinInput = { grid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], size: 4, window: 2 };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const at = (i: number) => frames[i]?.meta["values"] as number[];
        expect(Number(frames[1]?.meta["windows"])).toBe(expected.windowCount);
        expected.regularWindows.forEach((v, i) => expect(at(1)[i]).toBeCloseTo(v, 6));
        expected.regularOutput.forEach((v, i) => expect(at(2)[i]).toBeCloseTo(v, 6));
        expected.shiftedWindows.forEach((v, i) => expect(at(4)[i]).toBeCloseTo(v, 6));
        expected.shiftedOutput.forEach((v, i) => expect(at(5)[i]).toBeCloseTo(v, 6));
    });

    it("the shifted windows actually cross regular boundaries", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const regular = frames[1]?.meta["values"] as number[];
        const shifted = frames[4]?.meta["values"] as number[];
        expect(shifted.some((value, i) => value !== regular[i])).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
