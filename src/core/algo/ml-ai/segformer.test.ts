/**
 * segformer.test.ts - Brute-force Mix-MLP recomputation, shape properties,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { segformer } from "./segformer";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

/** Independent convolution + MLP + decoder recomputation. */
function reference(grid: number[][], kernel: number[][], w1: number, b1: number, w2: number, b2: number) {
    const rows = grid.length;
    const cols = grid[0].length;
    const predicted: number[][] = [];
    const logits: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const pRow: number[] = [];
        const lRow: number[] = [];
        for (let c = 0; c < cols; c += 1) {
            let sum = 0;
            for (let rr = Math.max(0, r - 1); rr <= Math.min(rows - 1, r + 1); rr += 1) {
                for (let cc = Math.max(0, c - 1); cc <= Math.min(cols - 1, c + 1); cc += 1) {
                    sum += grid[rr][cc] * kernel[rr - r + 1][cc - c + 1];
                }
            }
            const hidden = Math.max(0, sum * w1 + b1);
            const logit = hidden * w2 + b2;
            lRow.push(logit);
            pRow.push(logit >= 0 ? 1 : 0);
        }
        predicted.push(pRow);
        logits.push(lRow);
    }
    return { predicted, logits };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBeDefined();
        expect(frame.meta["cols"]).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("SegFormer block", () => {
    it("matches an independent convolution and decoder on random grids", () => {
        const kernel = [
            [0, 1, 0],
            [1, -4, 1],
            [0, 1, 0],
        ];
        for (let seed = 0; seed < 12; seed += 1) {
            const rows = 3 + (seed % 3);
            const cols = 3 + ((seed + 1) % 3);
            const grid = Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => ((r * 5 + c * 7 + seed) % 9) - 4),
            );
            const w1 = 0.5 + seed / 20;
            const b1 = seed % 3;
            const w2 = 1 - seed / 30;
            const b2 = (seed % 5) - 2;
            const got = segformer(grid, { kernel, w1, b1, w2, b2 });
            const ref = reference(grid, kernel, w1, b1, w2, b2);
            expect(got.logits).toEqual(ref.logits);
            expect(got.predicted).toEqual(ref.predicted);
        }
    });

    it("preserves grid shape and emits binary classes", () => {
        const grid = [
            [1, 2],
            [3, 4],
            [5, 6],
        ];
        const out = segformer(grid);
        expect(out.mixed.length).toBe(3);
        expect(out.predicted[0].length).toBe(2);
        for (const row of out.predicted) for (const v of row) expect([0, 1]).toContain(v);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["classOneCount"]).toBeGreaterThanOrEqual(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
