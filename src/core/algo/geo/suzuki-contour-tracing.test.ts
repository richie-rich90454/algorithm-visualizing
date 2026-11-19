/**
 * suzuki-contour-tracing.test.ts - Brute-force boundary coverage, border
 * counts from independent flood fills, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./suzuki-contour-tracing";
import type { VisualFrame } from "@/types";

const N4: Array<[number, number]> = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const N8: Array<[number, number]> = [
    [-1, 0], [-1, 1], [0, 1], [1, 1],
    [1, 0], [1, -1], [0, -1], [-1, -1],
];
const key = (r: number, c: number) => `${r},${c}`;

/** A foreground cell is a boundary cell if a 4-neighbor is background or outside. */
function bruteBoundary(grid: number[][]): Set<string> {
    const result = new Set<string>();
    const rows = grid.length;
    const cols = grid[0].length;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r][c] !== 1) {
                continue;
            }
            for (const [dr, dc] of N4) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === 0) {
                    result.add(key(r, c));
                    break;
                }
            }
        }
    }
    return result;
}

/** Count 8-connected foreground components and enclosed background holes. */
function bruteCounts(grid: number[][]): { components: number; holes: number } {
    const rows = grid.length;
    const cols = grid[0].length;
    const seenFg = new Set<string>();
    const seenBg = new Set<string>();
    let components = 0;
    let holes = 0;
    const flood = (sr: number, sc: number, foreground: boolean, seen: Set<string>, dirs: Array<[number, number]>) => {
        let touchesEdge = false;
        const queue: Array<[number, number]> = [[sr, sc]];
        seen.add(key(sr, sc));
        while (queue.length > 0) {
            const shifted = queue.shift();
            if (!shifted) {
                break;
            }
            const [r, c] = shifted;
            if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                touchesEdge = true;
            }
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                const k = key(nr, nc);
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || seen.has(k)) {
                    continue;
                }
                const value = grid[nr][nc];
                if ((foreground && value === 1) || (!foreground && value === 0)) {
                    seen.add(k);
                    queue.push([nr, nc]);
                }
            }
        }
        return touchesEdge;
    };
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r][c] === 1 && !seenFg.has(key(r, c))) {
                flood(r, c, true, seenFg, N8);
                components += 1;
            }
        }
    }
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r][c] === 0 && !seenBg.has(key(r, c))) {
                const touchesEdge = flood(r, c, false, seenBg, N4);
                if (!touchesEdge) {
                    holes += 1;
                }
            }
        }
    }
    return { components, holes };
}

function checkFrames(frames: VisualFrame[], grid: number[][]): void {
    const cells = grid.length * grid[0].length;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function labeledCells(frame: VisualFrame): Set<string> {
    const result = new Set<string>();
    for (const entity of frame.entities) {
        if (Number(entity.metadata["border"]) >= 1) {
            result.add(`${entity.metadata["row"]},${entity.metadata["col"]}`);
        }
    }
    return result;
}

const ring: number[][] = [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
];
const twoSquares: number[][] = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 1, 1],
    [0, 1, 1, 1, 0, 1, 1],
    [0, 1, 1, 1, 0, 1, 1],
    [0, 0, 0, 0, 0, 0, 0],
];
const single: number[][] = [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
];

describe("SuzukiContourTracing", () => {
    it("covers exactly the brute-force boundary cells", () => {
        const grids = [(mod.defaultInput as { grid: number[][] }).grid, ring, twoSquares, single];
        for (const grid of grids) {
            const frames = [...mod.run({ grid })];
            checkFrames(frames, grid);
            const expected = bruteBoundary(grid);
            const actual = labeledCells(frames[frames.length - 1]);
            expect([...actual].sort()).toEqual([...expected].sort());
        }
    });

    it("finds one border per component plus one per hole", () => {
        const grids = [(mod.defaultInput as { grid: number[][] }).grid, ring, twoSquares, single];
        for (const grid of grids) {
            const { components, holes } = bruteCounts(grid);
            const final = [...mod.run({ grid })].at(-1);
            expect(Number(final?.meta["borders"])).toBe(components + holes);
            expect(Number(final?.meta["outerBorders"])).toBe(components);
        }
    });

    it("traces consecutive border cells as eight-neighbors", () => {
        const frames = [...mod.run({ grid: ring })];
        const tracing = frames.slice(1, -1);
        let previous: [number, number] | null = null;
        let currentBorder = -1;
        for (const frame of tracing) {
            const borderMatch = /Border (\d+)/.exec(frame.description);
            const border = borderMatch ? Number(borderMatch[1]) : -1;
            if (border !== currentBorder) {
                currentBorder = border;
                previous = null;
            }
            const highlighted = frame.entities.find((entity) => entity.state === "highlight");
            expect(highlighted).toBeDefined();
            const cell: [number, number] = [
                Number(highlighted?.metadata["row"]),
                Number(highlighted?.metadata["col"]),
            ];
            if (previous) {
                const prev = previous;
                const adjacent = N8.some(([dr, dc]) => prev[0] + dr === cell[0] && prev[1] + dc === cell[1]);
                expect(adjacent).toBe(true);
            }
            previous = cell;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        let lastStep = -1;
        for (const frame of generator) {
            count += 1;
            lastStep = frame.stepNumber;
        }
        expect(count).toBe(lastStep + 1);
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
