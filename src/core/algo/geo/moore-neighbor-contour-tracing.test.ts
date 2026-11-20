/** moore-neighbor-contour-tracing.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./moore-neighbor-contour-tracing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independently list foreground cells with at least one background 4-neighbor. */
function boundaryCells(grid: number[][]): Set<string> {
    const result = new Set<string>();
    for (let r = 0; r < grid.length; r += 1) {
        for (let c = 0; c < (grid[r]?.length ?? 0); c += 1) {
            if (grid[r]![c] !== 1) continue;
            const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
            const isBoundary = neighbors.some(([nr, nc]) => {
                if (nr < 0 || nc < 0 || nr >= grid.length || nc >= (grid[nr]?.length ?? 0)) return true;
                return grid[nr]?.[nc] !== 1;
            });
            if (isBoundary) result.add(`${r},${c}`);
        }
    }
    return result;
}

/** Read the ordered contour from the per-step frame metadata. */
function contourFromFrames(frames: VisualFrame[]): Array<[number, number]> {
    return frames
        .filter((frame) => frame.meta["current"] !== undefined)
        .map((frame) => frame.meta["current"] as [number, number]);
}

describe("Moore-Neighbor Contour Tracing", () => {
    it("traces exactly the boundary cells of a solid block", () => {
        const input = mod.defaultInput as { grid: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const contour = contourFromFrames(frames);
        expect(contour.length).toBeGreaterThan(0);
        const traced = new Set(contour.map(([r, c]) => `${r},${c}`));
        const expected = boundaryCells(input.grid);
        expect(traced).toEqual(expected);
        expect(Number(frames[frames.length - 1]?.meta["distinctCells"])).toBe(expected.size);
    });

    it("closes the loop and keeps consecutive cells adjacent", () => {
        const input = mod.defaultInput as { grid: number[][] };
        const frames = [...mod.run(input)];
        const contour = contourFromFrames(frames);
        const start = frames[0]?.meta["start"] as [number, number];
        const firstStep = contour[0]!;
        expect(Math.max(Math.abs(firstStep[0] - start[0]), Math.abs(firstStep[1] - start[1]))).toBe(1);
        expect(contour[contour.length - 1]).toEqual(start);
        for (let i = 1; i < contour.length; i += 1) {
            const [r0, c0] = contour[i - 1]!;
            const [r1, c1] = contour[i]!;
            expect(Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0))).toBe(1);
        }
    });

    it("handles an empty grid and a single cell", () => {
        const empty = [...mod.run({ grid: [[0, 0], [0, 0]] })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["valid"]).toBe(false);
        const single = [...mod.run({ grid: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] })];
        checkFrames(single);
        expect(Number(single[single.length - 1]?.meta["distinctCells"])).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
