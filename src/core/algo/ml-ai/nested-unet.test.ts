/**
 * nested-unet.test.ts - Brute-force pooling and nested-skip recomputation,
 * constant-map property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { nestedUnet, pool2, upsample } from "./nested-unet";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function refPool(grid: number[][]): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < Math.floor(grid.length / 2); r += 1) {
        const row: number[] = [];
        for (let c = 0; c < Math.floor((grid[0]?.length ?? 0) / 2); c += 1) {
            const block = [
                grid[2 * r]?.[2 * c],
                grid[2 * r]?.[2 * c + 1],
                grid[2 * r + 1]?.[2 * c],
                grid[2 * r + 1]?.[2 * c + 1],
            ].filter((v) => v !== undefined) as number[];
            row.push(block.reduce((a, b) => a + b, 0) / block.length);
        }
        out.push(row);
    }
    return out;
}

function refUp(grid: number[][], rows: number, cols: number): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: number[] = [];
        const sr = Math.min(grid.length - 1, Math.floor(((r + 0.5) * grid.length) / rows));
        for (let c = 0; c < cols; c += 1) {
            const sc = Math.min((grid[0]?.length ?? 1) - 1, Math.floor(((c + 0.5) * (grid[0]?.length ?? 1)) / cols));
            row.push(grid[sr][sc]);
        }
        out.push(row);
    }
    return out;
}

function reference(grid: number[][]) {
    const rows = grid.length;
    const cols = grid[0].length;
    const e1 = refPool(grid);
    const e2 = refPool(e1);
    const up1 = refUp(e2, e1.length, e1[0].length);
    const nest1 = e1.map((row, r) => row.map((v, c) => 0.5 * v + 0.5 * up1[r][c]));
    const up0 = refUp(nest1, rows, cols);
    const nest0 = grid.map((row, r) => row.map((v, c) => 0.5 * v + 0.5 * up0[r][c]));
    const direct = refUp(e1, rows, cols);
    const output = nest0.map((row, r) => row.map((v, c) => v + 0.25 * direct[r][c]));
    return { output };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        const rows = Number(frame.meta["rows"]);
        const cols = Number(frame.meta["cols"]);
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("Nested U-Net core", () => {
    it("matches an independent pooling and nested-skip computation", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const rows = 4 + 2 * (seed % 3);
            const cols = 4 + 2 * ((seed + 1) % 3);
            const grid = Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => ((r * 7 + c * 5 + seed) % 13) - 6),
            );
            const got = nestedUnet(grid);
            const ref = reference(grid);
            for (let r = 0; r < rows; r += 1) {
                for (let c = 0; c < cols; c += 1) {
                    expect(got.output[r][c]).toBeCloseTo(ref.output[r][c], 10);
                }
            }
        }
    });

    it("keeps constant maps constant and preserves shape", () => {
        const grid = [
            [2, 2, 2, 2],
            [2, 2, 2, 2],
            [2, 2, 2, 2],
            [2, 2, 2, 2],
        ];
        expect(pool2(grid)).toEqual([[2, 2], [2, 2]]);
        expect(upsample([[2]], 4, 4)).toEqual(grid);
        const out = nestedUnet(grid).output;
        expect(out.length).toBe(4);
        expect(out[0].length).toBe(4);
        for (const row of out) for (const v of row) expect(v).toBeCloseTo(2.5, 10);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
