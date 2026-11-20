/**
 * longest-increasing-path-dp.test.ts - Brute-force DFS verification and frame checks.
 */

import { describe, expect, it } from "vitest";
import module from "./longest-increasing-path-dp";

type Grid = number[][];

function collect(input: unknown) {
    const frames = [];
    for (const frame of module.run(input)) {
        frames.push(frame);
        if (frames.length > 100000) {
            throw new Error("generator did not terminate");
        }
    }
    return frames;
}

/** Exhaustive DFS from every cell, with no memoization. */
function bruteForce(grid: Grid): number {
    const rows = grid.length;
    const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;
    if (rows === 0 || cols === 0) {
        return 0;
    }
    const dfs = (r: number, c: number): number => {
        let best = 1;
        const value = grid[r]?.[c] ?? 0;
        for (const [dr, dc] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ]) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                continue;
            }
            if ((grid[nr]?.[nc] ?? 0) < value) {
                best = Math.max(best, 1 + dfs(nr, nc));
            }
        }
        return best;
    };
    let answer = 0;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            answer = Math.max(answer, dfs(r, c));
        }
    }
    return answer;
}

function shuffled(rows: number, cols: number, seed: number): Grid {
    const size = rows * cols;
    const values = Array.from({ length: size }, (_, i) => i + 1);
    for (let i = values.length - 1; i > 0; i -= 1) {
        const j = (i * 37 + seed * 17) % (i + 1);
        [values[i], values[j]] = [values[j]!, values[i]!];
    }
    const grid: Grid = [];
    for (let r = 0; r < rows; r += 1) {
        grid.push(values.slice(r * cols, (r + 1) * cols));
    }
    return grid;
}

describe("longestIncreasingPathDp", () => {
    it("agrees with exhaustive DFS on many grids", () => {
        const cases: Grid[] = [
            [],
            [[5]],
            [
                [1, 2, 3],
                [6, 5, 4],
                [7, 8, 9],
            ],
            [
                [9, 8, 7],
                [2, 1, 6],
                [3, 4, 5],
            ],
        ];
        for (let seed = 0; seed < 12; seed += 1) {
            cases.push(shuffled(2, 2 + (seed % 3), seed));
            cases.push(shuffled(3, 3, seed + 40));
            cases.push(shuffled(2, 4, seed + 80));
        }
        for (const grid of cases) {
            const frames = collect({ grid });
            const final = frames[frames.length - 1]!;
            expect(final.meta.best).toBe(bruteForce(grid));
        }
    });

    it("highlights a path of exactly the reported length", () => {
        for (const grid of [
            [
                [1, 2, 3],
                [6, 5, 4],
                [7, 8, 9],
            ],
            shuffled(3, 3, 3),
        ]) {
            const frames = collect({ grid });
            const final = frames[frames.length - 1]!;
            const pathCells = final.entities.filter((entity) => entity.state === "path");
            expect(pathCells.length).toBe(final.meta.best);
        }
    });

    it("emits well-formed grid frames and terminates", () => {
        for (const grid of [
            [
                [1, 2],
                [4, 3],
            ],
            [],
        ]) {
            const frames = collect({ grid });
            const lines = module.pseudocode?.length ?? 1;
            const rows = grid.length;
            const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;
            frames.forEach((frame, index) => {
                expect(frame.stepNumber).toBe(index);
                expect(frame.description.length).toBeGreaterThanOrEqual(10);
                expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
                expect(frame.codeLineNumber).toBeLessThan(lines);
                expect(frame.layout).toBe("grid");
                expect(frame.meta.rows).toBe(rows);
                expect(frame.meta.cols).toBe(cols);
                for (const entity of frame.entities) {
                    expect(entity.type).toBe("cell");
                }
            });
            expect(frames.length).toBeGreaterThan(0);
        }
    });
});
