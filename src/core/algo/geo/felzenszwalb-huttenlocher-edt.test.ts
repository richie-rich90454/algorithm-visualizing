/** felzenszwalb-huttenlocher-edt.test.ts - Brute-force squared-distance reference and frames. */

import { describe, expect, it } from "vitest";
import mod from "./felzenszwalb-huttenlocher-edt";

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 2000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(2000);
    return frames;
}

/** Independent O(features * pixels) computation of the squared distance. */
function bruteForce(grid: number[][]): number[][] {
    const rows = grid.length;
    const cols = Math.max(...grid.map((row) => row.length));
    const features: Array<[number, number]> = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r]?.[c]) features.push([r, c]);
        }
    }
    const out: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: number[] = [];
        for (let c = 0; c < cols; c += 1) {
            let best = Infinity;
            for (const [fr, fc] of features) best = Math.min(best, (r - fr) ** 2 + (c - fc) ** 2);
            row.push(best);
        }
        out.push(row);
    }
    return out;
}

function makeGrids(): number[][][] {
    const grids: number[][][] = [
        [[1, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 1]],
        [[1, 1, 1], [1, 1, 1]],
        [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]],
    ];
    let seed = 98765;
    const next = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % 7;
    };
    for (let t = 0; t < 12; t += 1) {
        const rows = 2 + (t % 5);
        const cols = 2 + ((t + 1) % 5);
        const grid: number[][] = [];
        for (let r = 0; r < rows; r += 1) {
            const row: number[] = [];
            for (let c = 0; c < cols; c += 1) row.push(next() === 0 ? 1 : 0);
            grid.push(row);
        }
        if (grid.flat().some((v) => v === 1)) grids.push(grid);
    }
    return grids;
}

describe("Felzenszwalb-Huttenlocher Distance Transform", () => {
    it("matches a brute-force squared-distance reference on many images", () => {
        for (const grid of makeGrids()) {
            const frames = framesFor({ grid });
            const final = frames[frames.length - 1]!;
            const flat = final.meta.dist2 as number[];
            const expected = bruteForce(grid);
            let k = 0;
            for (let r = 0; r < expected.length; r += 1) {
                for (let c = 0; c < expected[r]!.length; c += 1) {
                    expect(flat[k]!).toBe(expected[r]![c]!);
                    k += 1;
                }
            }
            expect(k).toBe(flat.length);
        }
    });

    it("marks features with distance zero and preserves the feature count", () => {
        const grid = [[1, 0, 0], [0, 0, 0], [0, 0, 1]];
        const frames = framesFor({ grid });
        const final = frames[frames.length - 1]!;
        const flat = final.meta.dist2 as number[];
        expect(flat).toEqual([0, 1, 4, 1, 2, 1, 4, 1, 0]);
        expect(flat.filter((v) => v === 0).length).toBe(2);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber!).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            expect(frame.entities.length).toBe(25);
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            expect(frame.edges.length).toBe(0);
        });
    });
});
