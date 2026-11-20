import { describe, expect, it } from "vitest";
import mod from "./medial-axis";

type Grid = number[][];

/** Brute-force characterization of the medial axis, independent of the module. */
function expectedAxis(grid: Grid): Array<[number, number]> {
    const rows = grid.length;
    const cols = rows > 0 ? (grid[0] as number[]).length : 0;
    const background: Array<[number, number]> = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if ((grid[r] as number[])[c] === 0) {
                background.push([r, c]);
            }
        }
    }
    const dirs: Array<[number, number]> = [
        [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1],
    ];
    const dist = (r: number, c: number): { best: number; directions: Set<string> } => {
        let best = Infinity;
        const directions = new Set<string>();
        for (const [br, bc] of background) {
            const d = (r - br) ** 2 + (c - bc) ** 2;
            if (d < best) {
                best = d;
                directions.clear();
            }
            if (d <= best) {
                directions.add(`${Math.sign(r - br)},${Math.sign(c - bc)}`);
            }
        }
        return { best, directions };
    };
    const result: Array<[number, number]> = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if ((grid[r] as number[])[c] !== 1) {
                continue;
            }
            const info = dist(r, c);
            if (info.directions.size < 2) {
                continue;
            }
            const dominated = dirs.some(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                return (
                    nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                    (grid[nr] as number[])[nc] === 1 && dist(nr, nc).best > info.best
                );
            });
            if (!dominated) {
                result.push([r, c]);
            }
        }
    }
    return result;
}

function defaultGridInput(): Grid {
    return Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 13 }, (_, c) => (r >= 1 && r <= 7 && c >= 1 && c <= 11 ? 1 : 0)),
    );
}

function finalFrame(grid: Grid) {
    const all = [...mod.run({ grid })];
    return { all, final: all[all.length - 1]! };
}

describe("Medial Axis", () => {
    it("matches a brute-force characterization on several shapes", () => {
        const grids: Grid[] = [
            defaultGridInput(),
            [
                [0, 0, 0, 0, 0],
                [0, 1, 1, 1, 0],
                [0, 1, 1, 1, 0],
                [0, 1, 1, 1, 0],
                [0, 0, 0, 0, 0],
            ],
            [
                [0, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 1, 0],
                [0, 0, 1, 1, 0, 0],
                [0, 0, 1, 1, 0, 0],
                [0, 1, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0],
            ],
        ];
        for (const grid of grids) {
            const { final } = finalFrame(grid);
            expect(final.meta["axis"]).toEqual(expectedAxis(grid));
        }
    });

    it("produces a horizontal center segment for the default rectangle", () => {
        const { final } = finalFrame(defaultGridInput());
        const axis = final.meta["axis"] as Array<[number, number]>;
        expect(axis.length).toBeGreaterThan(0);
        expect(axis.every(([r]) => r === 4)).toBe(true);
        const cols = axis.map(([, c]) => c);
        expect(Math.min(...cols)).toBe(4);
        expect(Math.max(...cols)).toBe(8);
    });

    it("emits well-formed frames with sequential steps and in-range code lines", () => {
        const { all } = finalFrame(defaultGridInput());
        expect(all.length).toBeGreaterThanOrEqual(5);
        all.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("grid");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
            expect(frame.meta["rows"]).toBe(9);
            expect(frame.meta["cols"]).toBe(13);
            for (const entity of frame.entities) {
                expect(entity.type).toBe("cell");
                expect(typeof entity.metadata["row"]).toBe("number");
                expect(typeof entity.metadata["col"]).toBe("number");
            }
        });
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of mod.run(mod.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(100);
        }
        expect(count).toBeGreaterThan(0);
    });
});
