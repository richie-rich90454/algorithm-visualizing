/**
 * zhang-suen-thinning.ts - Two-subiteration binary image thinning.
 *
 * Zhang-Suen repeatedly peels the boundary of a foreground shape one pixel at
 * a time. In each subiteration a foreground pixel is deleted only when it has
 * between two and six foreground neighbors, exactly one zero-to-one neighbor
 * transition around its ring, and two specific sets of cardinal neighbors are
 * not all foreground. Alternating the two tests preserves connectivity while
 * reducing thick regions to a one-pixel skeleton.
 *
 *   Time:  O(iterations * rows * cols)
 *   Space: O(rows * cols)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cells(grid: number[][], highlight: Array<[number, number]> = []): VisualEntity[] {
    const marked = new Set(highlight.map(([r, c]) => `${r},${c}`));
    const out: VisualEntity[] = [];
    for (let r = 0; r < grid.length; r += 1) {
        const row = grid[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            const value = row[c] ?? 0;
            out.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: value === 1 ? "1" : "0",
                value,
                state: marked.has(`${r},${c}`)
                    ? "comparing"
                    : value === 1
                      ? "sorted"
                      : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return out;
}

function transitions(ring: number[]): number {
    let count = 0;
    for (let i = 0; i < ring.length; i += 1) {
        if (ring[i] === 0 && ring[(i + 1) % ring.length] === 1) count += 1;
    }
    return count;
}

function markForDeletion(grid: number[][], step: 1 | 2): Array<[number, number]> {
    const marked: Array<[number, number]> = [];
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    for (let r = 1; r < rows - 1; r += 1) {
        for (let c = 1; c < cols - 1; c += 1) {
            if (grid[r]![c] !== 1) continue;
            const p2 = grid[r - 1]![c]!;
            const p3 = grid[r - 1]![c + 1]!;
            const p4 = grid[r]![c + 1]!;
            const p5 = grid[r + 1]![c + 1]!;
            const p6 = grid[r + 1]![c]!;
            const p7 = grid[r + 1]![c - 1]!;
            const p8 = grid[r]![c - 1]!;
            const p9 = grid[r - 1]![c - 1]!;
            const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (B < 2 || B > 6) continue;
            const A = transitions([p2, p3, p4, p5, p6, p7, p8, p9]);
            if (A !== 1) continue;
            const remove =
                step === 1
                    ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
                    : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
            if (remove) marked.push([r, c]);
        }
    }
    return marked;
}

function copy(grid: number[][]): number[][] {
    return grid.map((row) => [...row]);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { image?: number[][]; maxIterations?: number } | null) ?? {};
    const source: number[][] = task.image ?? [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0],
    ];
    const grid = copy(source);
    const maxIterations = task.maxIterations ?? 100;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    let step = 0;
    const count = (): number => grid.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
    const frame = (
        highlight: Array<[number, number]>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: cells(grid, highlight),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { rows, cols, remaining: count(), ...meta },
    });

    yield frame([], `Thinning a ${rows}x${cols} binary image with Zhang-Suen.`, 0);
    step += 1;
    let iteration = 0;
    while (iteration < maxIterations && step < 14) {
        let changed = false;
        for (const substep of [1, 2] as const) {
            const marked = markForDeletion(grid, substep);
            if (marked.length > 0) {
                for (const [r, c] of marked) grid[r]![c] = 0;
                changed = true;
            }
            yield frame(
                marked,
                `Subiteration ${substep} removed ${marked.length} pixel(s) at iteration ${iteration + 1}.`,
                substep,
                { iteration: iteration + 1, substep, removed: marked.length },
            );
            step += 1;
            if (step >= 14) break;
        }
        iteration += 1;
        if (!changed) break;
    }
    yield frame([], `Skeleton has ${count()} foreground pixel(s) after ${iteration} iteration(s).`, 5, {
        iterations: iteration,
        remaining: count(),
        grid: grid.map((row) => row.join("")),
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Zhang-Suen thinning peels the outside of a thick black shape until only a thin skeleton is left. It looks at each pixel's eight neighbors and deletes it only when doing so will not break the shape into pieces or erase an endpoint. The test is split into two alternating subiterations so that symmetric patterns are removed consistently instead of being eaten from only one side.",
        invariants: [
            "A pixel is deleted only when it has between two and six foreground neighbors.",
            "The zero-to-one transition count around the ring is exactly one, so endpoints and branches survive.",
            "Deletions in a subiteration are applied simultaneously, never using already updated neighbors.",
        ],
        correctness:
            "The neighbor-count and transition conditions characterize simple boundary pixels whose removal does not split a component or collapse a two-pixel-wide feature. Using the pre-subiteration snapshot for all tests prevents order dependence, and alternating the two symmetric conditions removes opposing boundary pixels fairly. Repeating until no pixel qualifies leaves a connected, one-pixel-wide medial skeleton of the original shape.",
        complexityRationale:
            "Each subiteration visits every pixel once and performs a constant number of neighbor tests, so one full iteration is O(rows times cols). The number of iterations is bounded by the shape thickness, and the grid copy for simultaneous deletion uses O(rows times cols) space.",
        uses: [
            "Extracting skeletons from scanned fingerprints",
            "Preparing binary shapes for optical character recognition",
            "Thinning medical image contours before measurement",
        ],
        references: [
            "Zhang and Suen, A Fast Parallel Algorithm for Thinning Digital Patterns, Communications of the ACM 27 (1984)",
            "Gonzalez and Woods, Digital Image Processing, Chapter 9",
        ],
        workedExample:
            "A solid five-by-five block has interior pixels with eight neighbors, so they fail the neighbor-count test and stay until the boundary is peeled. After a few alternating subiterations the block collapses to a small cross-shaped skeleton whose center pixel has four branches and is kept by the transition test.",
    },
    id: "zhang-suen-thinning",
    name: "Zhang-Suen Thinning",
    category: "geometry",
    complexity: { time: "O(iterations * rows * cols)", space: "O(rows * cols)" },
    defaultInput: {
        image: [
            [0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the input image to a working grid",
        "for each foreground pixel count its eight neighbors",
        "measure zero-to-one transitions around the neighbor ring",
        "in subiteration one: delete pixels passing the first cardinal test",
        "in subiteration two: delete pixels passing the second cardinal test",
        "apply each subiteration's deletions simultaneously",
        "repeat until a full iteration makes no deletion",
        "report the remaining skeleton pixels",
    ],
};

export default module;
