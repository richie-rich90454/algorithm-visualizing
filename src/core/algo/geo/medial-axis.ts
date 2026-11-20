/**
 * medial-axis.ts - Medial Axis by Exact Distance Transform.
 *
 * The medial axis of a foreground shape is the set of points equidistant to
 * two or more boundary points; it is the locus of centers of maximal inscribed
 * circles. On a grid we compute the exact Euclidean distance from every
 * foreground cell to the nearest background cell, keep cells that have at
 * least two nearest background cells in different directions, and thin the
 * result by discarding cells with a strictly farther neighbor.
 *
 * Time O(F * B + F) with F foreground and B background cells; space O(F).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = [number, number];

interface AxisResult {
    distances: number[][];
    nearestCount: number[][];
    axis: Cell[];
    boundary: Cell[];
}

function computeMedialAxis(grid: number[][]): AxisResult {
    const rows = grid.length;
    const cols = rows > 0 ? (grid[0] as number[]).length : 0;
    const background: Cell[] = [];
    const boundary: Cell[] = [];

    for (let r = 0; r < rows; r += 1) {
        const row = grid[r] as number[];
        for (let c = 0; c < cols; c += 1) {
            if (row[c] === 0) {
                background.push([r, c]);
            }
        }
    }

    const dirs: Cell[] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [r, c] of background) {
        const touches = dirs.some(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            return nr >= 0 && nr < rows && nc >= 0 && nc < cols && (grid[nr] as number[])[nc] === 1;
        });
        if (touches) {
            boundary.push([r, c]);
        }
    }

    const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    const nearestCount: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if ((grid[r] as number[])[c] !== 1) {
                continue;
            }
            let best = Infinity;
            let count = 0;
            const directions = new Set<string>();
            for (const [br, bc] of background) {
                const dr = r - br;
                const dc = c - bc;
                const dist = dr * dr + dc * dc;
                if (dist < best) {
                    best = dist;
                    count = 1;
                    directions.clear();
                    directions.add(`${Math.sign(dr)},${Math.sign(dc)}`);
                } else if (dist === best) {
                    count += 1;
                    directions.add(`${Math.sign(dr)},${Math.sign(dc)}`);
                }
            }
            (distances[r] as number[])[c] = background.length === 0 ? 0 : Math.sqrt(best);
            (nearestCount[r] as number[])[c] = directions.size;
        }
    }

    const axis: Cell[] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if ((grid[r] as number[])[c] !== 1) {
                continue;
            }
            const d = (distances[r] as number[])[c] as number;
            const tie = (nearestCount[r] as number[])[c] as number;
            if (tie < 2) {
                continue;
            }
            let dominated = false;
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    continue;
                }
                if ((grid[nr] as number[])[nc] === 1 && (distances[nr] as number[])[nc]! > d) {
                    dominated = true;
                    break;
                }
            }
            if (!dominated) {
                axis.push([r, c]);
            }
        }
    }

    return { distances, nearestCount, axis, boundary };
}

function makeCells(
    grid: number[][],
    states: Map<string, EntityState>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < grid.length; r += 1) {
        const row = grid[r] as number[];
        for (let c = 0; c < row.length; c += 1) {
            const key = `${r},${c}`;
            const value = row[c] as number;
            entities.push({
                id: `cell-${key}`,
                type: "cell" as const,
                label: value === 1 ? "#" : ".",
                value,
                state: states.get(key) ?? (value === 1 ? "idle" : "unvisited"),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, inside: value === 1 },
            });
        }
    }
    return entities;
}

function defaultGrid(): number[][] {
    const grid: number[][] = [];
    for (let r = 0; r < 9; r += 1) {
        const row: number[] = [];
        for (let c = 0; c < 13; c += 1) {
            row.push(r >= 1 && r <= 7 && c >= 1 && c <= 11 ? 1 : 0);
        }
        grid.push(row);
    }
    return grid;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: number[][] } | null) ?? {};
    const grid = Array.isArray(task.grid) && task.grid.length > 0 ? task.grid : defaultGrid();
    const rows = grid.length;
    const cols = rows > 0 ? (grid[0] as number[]).length : 0;
    const result = computeMedialAxis(grid);

    let step = 0;
    const frame = (
        states: Map<string, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | Cell[] | null> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(grid, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { rows, cols, axisCount: result.axis.length, ...extra },
    });

    yield frame(new Map(), `Medial axis on a ${rows}x${cols} grid: # is foreground, . is background.`, 0);
    step += 1;

    const boundaryStates = new Map<string, EntityState>();
    for (const [r, c] of result.boundary) {
        boundaryStates.set(`${r},${c}`, "active");
    }
    yield frame(boundaryStates, `Marked ${result.boundary.length} boundary cell(s) that touch the shape.`, 1, {
        boundaryCount: result.boundary.length,
    });
    step += 1;

    const band = Math.max(1, Math.ceil(rows / 3));
    for (let start = 0; start < rows; start += band) {
        const states = new Map<string, EntityState>();
        for (const [r, c] of result.boundary) {
            states.set(`${r},${c}`, "active");
        }
        const end = Math.min(rows, start + band);
        for (let r = start; r < end; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                if ((grid[r] as number[])[c] === 1) {
                    states.set(`${r},${c}`, "comparing");
                }
            }
        }
        yield frame(states, `Distance transform: computing squared distances for rows ${start} to ${end - 1}.`, 2, {
            rowStart: start,
            rowEnd: end - 1,
        });
        step += 1;
    }

    const tieStates = new Map<string, EntityState>();
    for (const [r, c] of result.boundary) {
        tieStates.set(`${r},${c}`, "active");
    }
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if ((result.nearestCount[r] as number[])[c]! >= 2) {
                tieStates.set(`${r},${c}`, "highlight");
            }
        }
    }
    yield frame(tieStates, "Cells equidistant to at least two boundary cells are candidates.", 3);
    step += 1;

    const axisStates = new Map<string, EntityState>();
    for (const [r, c] of result.boundary) {
        axisStates.set(`${r},${c}`, "active");
    }
    for (const [r, c] of result.axis) {
        axisStates.set(`${r},${c}`, "sorted");
    }
    yield frame(
        axisStates,
        `Done: medial axis has ${result.axis.length} cell(s) after thinning non-maximal candidates.`,
        4,
        { axis: result.axis },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The medial axis is the skeleton of a shape: the set of centers of the largest circles that fit inside it. A center belongs to the skeleton when it touches the boundary in at least two directions, because then no nearby point can have a larger inscribed circle. On a grid we measure the exact distance from each inside cell to the closest outside cell and keep the ties that local maxima do not dominate.",
        invariants: [
            "Every distance is the exact Euclidean distance to the nearest background cell.",
            "A cell is a candidate only when it has at least two nearest boundary directions.",
            "A cell dominated by a strictly farther neighbor cannot lie on the medial axis.",
        ],
        correctness:
            "A center of a maximal inscribed circle is equidistant from at least two boundary points; if it were equidistant from only one, the circle could grow toward the opposite side. Conversely, a cell with two or more nearest boundary points and no strictly farther neighbor is the center of a circle that cannot be enlarged in any direction, which is the definition of a maximal circle. Keeping exactly those cells therefore yields the medial axis.",
        complexityRationale:
            "For each of the F foreground cells we scan all B background cells to find the nearest distance, giving O(F * B) time, then a constant-time eight-neighbor thinning pass. The distance and tie maps hold one value per cell, so space is O(F).",
        uses: [
            "Shape skeletonization for image analysis and pattern recognition",
            "Path planning and centerline extraction from occupied regions",
            "Mesh generation and anatomical shape measurement",
        ],
        references: [
            "Blum, A Transformation for Extracting New Descriptors of Shape, 1967",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Voronoi diagrams chapter",
        ],
        workedExample:
            "For a 7 by 11 filled rectangle surrounded by background, the center row has distance three to both the top and bottom borders, so each of its center cells is equidistant to two boundary points and survives thinning. Rows above and below touch only the nearest border and are discarded, leaving a horizontal skeleton segment.",
    },
    id: "medial-axis",
    name: "Medial Axis",
    category: "geometry",
    complexity: { time: "O(F·B)", space: "O(F)" },
    defaultInput: {
        grid: Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 13 }, (_, c) => (r >= 1 && r <= 7 && c >= 1 && c <= 11 ? 1 : 0)),
        ),
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the binary foreground grid and find background cells",
        "mark background cells adjacent to the shape as boundary",
        "for each foreground cell compute distance to nearest background cell",
        "record cells with at least two nearest boundary directions",
        "discard candidates having a strictly farther neighbor",
        "done: the remaining cells form the medial axis",
    ],
};

export default module;
