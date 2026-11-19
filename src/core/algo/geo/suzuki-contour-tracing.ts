/**
 * suzuki-contour-tracing.ts - Suzuki Border Following
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Suzuki's border-following scheme labels every contour between a foreground
 * region and its background, distinguishing the outer border of each component
 * from the inner borders that surround holes. Foreground components use eight
 * connectivity and background regions use four connectivity. Each border is
 * then walked as a closed cycle in clockwise order starting from its top-left
 * cell, which yields an ordered, labeled contour for every region boundary.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R * C) for the flood fills plus O(p) for p border pixels
 *   Space: O(R * C) for the component, region, and label maps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the binary image; foreground is ACTIVE, background IDLE.
 *   - The cell currently added to a contour is HIGHLIGHT.
 *   - The final frame colors outer borders SORTED and inner borders VISITED.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N8: Array<[number, number]> = [
    [-1, 0], [-1, 1], [0, 1], [1, 1],
    [1, 0], [1, -1], [0, -1], [-1, -1],
];
const N4: Array<[number, number]> = [[-1, 0], [0, 1], [1, 0], [0, -1]];

function key(r: number, c: number): string {
    return `${r},${c}`;
}

function cellsFromGrid(grid: number[][], labels: Map<string, number>, current = "", done = false): VisualEntity[] {
    return grid.flatMap((row, r) =>
        row.map((value, c) => {
            const k = key(r, c);
            let state: EntityState = value === 1 ? "active" : "idle";
            if (done) {
                const label = labels.get(k) ?? 0;
                if (label > 0) {
                    state = label % 2 === 1 ? "sorted" : "visited";
                } else if (value === 1) {
                    state = "active";
                }
            } else if (k === current) {
                state = "highlight";
            } else if (current && (labels.get(k) ?? 0) > 0) {
                state = "path";
            }
            return {
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: value === 1 ? "1" : "0",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, border: labels.get(k) ?? 0 },
            };
        }),
    );
}

/** Walk a border set as a closed clockwise cycle from its top-left cell. */
function traceCycle(set: Set<string>, start: string): string[] {
    const [sr, sc] = start.split(",").map(Number) as [number, number];
    let current = start;
    let back: [number, number] = [sr, sc - 1];
    const result: string[] = [];
    const limit = set.size * 8 + 8;
    for (let step = 0; step < limit; step += 1) {
        result.push(current);
        const [r, c] = current.split(",").map(Number) as [number, number];
        let backIndex = -1;
        for (let n = 0; n < 8; n += 1) {
            const dr = N8[n][0];
            const dc = N8[n][1];
            if (r + dr === back[0] && c + dc === back[1]) {
                backIndex = n;
                break;
            }
        }
        const begin = backIndex < 0 ? 0 : (backIndex + 1) % 8;
        let found = -1;
        for (let t = 0; t < 8; t += 1) {
            const n = (begin + t) % 8;
            const dr = N8[n][0];
            const dc = N8[n][1];
            if (set.has(key(r + dr, c + dc))) {
                found = n;
                break;
            }
        }
        if (found < 0) {
            break;
        }
        const nextR = r + N8[found][0];
        const nextC = c + N8[found][1];
        const previous = (found + 7) % 8;
        back = [r + N8[previous][0], c + N8[previous][1]];
        current = key(nextR, nextC);
        if (current === start) {
            break;
        }
    }
    return result;
}

/** Trace and label every outer and inner border of a binary image. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: number[][] } | null) ?? {};
    const grid: number[][] = Array.isArray(task.grid) && task.grid.length > 0
        ? task.grid.map((row) => row.map((v) => (v === 1 ? 1 : 0)))
        : [
              [0, 0, 0, 0, 0, 0, 0],
              [0, 1, 1, 1, 0, 1, 0],
              [0, 1, 0, 1, 0, 1, 0],
              [0, 1, 1, 1, 0, 1, 0],
              [0, 0, 0, 0, 0, 0, 0],
          ];
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    const component = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
    let componentCount = 0;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r][c] !== 1 || component[r][c] !== -1) {
                continue;
            }
            const id = componentCount;
            const queue: Array<[number, number]> = [[r, c]];
            component[r][c] = id;
            while (queue.length > 0) {
                const shifted = queue.shift();
                if (!shifted) {
                    break;
                }
                const [cr, cc] = shifted;
                for (const [dr, dc] of N8) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                        continue;
                    }
                    if (grid[nr][nc] === 1 && component[nr][nc] === -1) {
                        component[nr][nc] = id;
                        queue.push([nr, nc]);
                    }
                }
            }
            componentCount += 1;
        }
    }

    const region = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
    const outsideRegions = new Set<number>();
    let regionCount = 0;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r][c] !== 0 || region[r][c] !== -1) {
                continue;
            }
            const id = regionCount;
            const queue: Array<[number, number]> = [[r, c]];
            region[r][c] = id;
            let touchesEdge = false;
            while (queue.length > 0) {
                const shifted = queue.shift();
                if (!shifted) {
                    break;
                }
                const [cr, cc] = shifted;
                if (cr === 0 || cr === rows - 1 || cc === 0 || cc === cols - 1) {
                    touchesEdge = true;
                }
                for (const [dr, dc] of N4) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                        continue;
                    }
                    if (grid[nr][nc] === 0 && region[nr][nc] === -1) {
                        region[nr][nc] = id;
                        queue.push([nr, nc]);
                    }
                }
            }
            if (touchesEdge) {
                outsideRegions.add(id);
            }
            regionCount += 1;
        }
    }

    const borderSets = new Map<string, Set<string>>();
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r][c] !== 1) {
                continue;
            }
            for (const [dr, dc] of N4) {
                const nr = r + dr;
                const nc = c + dc;
                let bg: number;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    bg = -2;
                } else {
                    if (grid[nr][nc] !== 0) {
                        continue;
                    }
                    const reg = region[nr][nc];
                    bg = outsideRegions.has(reg) ? -2 : reg;
                }
                const group = `${component[r][c]}:${bg}`;
                if (!borderSets.has(group)) {
                    borderSets.set(group, new Set<string>());
                }
                const set = borderSets.get(group);
                if (set) {
                    set.add(key(r, c));
                }
            }
        }
    }

    const ordered = [...borderSets.entries()].map(([group, set]) => {
        const cells = [...set].sort((a, b) => {
            const [ar, ac] = a.split(",").map(Number) as [number, number];
            const [br, bc] = b.split(",").map(Number) as [number, number];
            return ar - br || ac - bc;
        });
        const bgId = Number(group.split(":")[1]);
        return { set, start: cells[0], outer: bgId === -2 || outsideRegions.has(bgId) };
    });
    ordered.sort((a, b) => {
        const [ar, ac] = a.start.split(",").map(Number) as [number, number];
        const [br, bc] = b.start.split(",").map(Number) as [number, number];
        return ar - br || ac - bc;
    });

    const labels = new Map<string, number>();
    const borderSizes: number[] = [];
    const borderOuter: boolean[] = [];
    ordered.forEach((border, index) => {
        borderSizes.push(border.set.size);
        borderOuter.push(border.outer);
        const cycle = traceCycle(border.set, border.start);
        for (const cell of cycle) {
            labels.set(cell, index + 1);
        }
    });

    const totalBorderPixels = labels.size;
    yield {
        stepNumber: 0,
        entities: cellsFromGrid(grid, labels),
        edges: [],
        description: `Scanning a ${rows} by ${cols} binary image for component and hole borders.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, borders: ordered.length, borderPixels: 0, borderSizes: [], outerBorders: borderOuter.filter(Boolean).length },
    };
    let step = 1;

    for (let borderIndex = 0; borderIndex < ordered.length; borderIndex += 1) {
        const border = ordered[borderIndex];
        const cycle = traceCycle(border.set, border.start);
        for (let position = 0; position < cycle.length; position += 1) {
            const cell = cycle[position];
            const kind = border.outer ? "outer" : "inner";
            yield {
                stepNumber: step,
                entities: cellsFromGrid(grid, labels, cell),
                edges: [],
                description: `Border ${borderIndex + 1} (${kind}): adding cell ${cell} at position ${position + 1} of ${cycle.length}.`,
                codeLineNumber: border.outer ? 4 : 5,
                layout: "grid",
                meta: { rows, cols, borders: ordered.length, borderPixels: step - 1, borderSizes: [], outerBorders: borderOuter.filter(Boolean).length },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: cellsFromGrid(grid, labels, "", true),
        edges: [],
        description: `Traced ${ordered.length} border(s) covering ${totalBorderPixels} cell(s); ${borderOuter.filter(Boolean).length} outer, ${ordered.length - borderOuter.filter(Boolean).length} inner.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows, cols, borders: ordered.length, borderPixels: totalBorderPixels, borderSizes, outerBorders: borderOuter.filter(Boolean).length },
    };
}

/** The Suzuki border-following module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A binary image can contain several shapes, and a shape can contain holes. Suzuki's idea is to walk every boundary between foreground and background and give each walk its own label, using eight-connectivity for the shapes and four-connectivity for the background so diagonal gaps do not leak. Walking from the top-left cell of each boundary in clockwise order produces an ordered contour you can replay or measure.",
        invariants: [
            "Foreground components use eight-connectivity while background regions use four-connectivity.",
            "A background region touching the image edge marks an outer border; an enclosed region marks a hole border.",
            "Every traced border is a closed cycle whose consecutive cells are eight-neighbors.",
        ],
        correctness:
            "Flood fill partitions foreground cells into components and background cells into regions. A foreground cell borders a region exactly when one of its four neighbors belongs to that region, so grouping those cells by component and region enumerates every contour. Starting each walk at the top-left cell with a west backtrack and repeatedly taking the first clockwise border neighbor visits the contour once and returns to the start, so the union of the traced cells is precisely the set of foreground cells adjacent to background.",
        complexityRationale:
            "The two flood fills visit each of the R times C cells a constant number of times, and each border pixel is examined a constant number of neighbor positions, so time is O(R * C). The component, region, and label maps store O(R * C) entries.",
        uses: [
            "Extracting object outlines in binary computer vision",
            "Counting holes and connected components in segmented images",
            "Preparing contour data for shape recognition and measurement",
        ],
        references: [
            "Suzuki and Abe, Topological Structural Analysis of Digitized Binary Images, 1985",
            "Gonzalez and Woods, Digital Image Processing, Chapter 10",
        ],
        workedExample:
            "In a five by five grid whose border is foreground and whose three by three center is background, the flood fills find one foreground ring and one enclosed background region. The algorithm labels an outer contour around the sixteen border cells and an inner contour around the eight cells facing the hole.",
    },
    id: "suzuki-contour-tracing",
    name: "Suzuki Contour Tracing",
    category: "geometry",
    complexity: { time: "O(R * C)", space: "O(R * C)" },
    defaultInput: {
        grid: [
            [0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1, 0],
            [0, 1, 1, 1, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the binary grid and scan it in raster order",
        "flood-fill each foreground cluster using eight-connectivity",
        "flood-fill each background region using four-connectivity",
        "group foreground cells that touch each background region",
        "label outer borders and inner hole borders in scan order",
        "start at the top-left cell with a west backtrack",
        "walk clockwise to the first border neighbor until the cycle closes",
        "done: report the ordered borders and their labels",
    ],
};

export default module;
