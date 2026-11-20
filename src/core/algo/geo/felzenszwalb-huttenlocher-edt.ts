/**
 * felzenszwalb-huttenlocher-edt.ts - Exact squared Euclidean distance transform.
 *
 * For a binary image the transform gives, at every pixel, the squared distance
 * to the nearest feature pixel. A one-dimensional pass builds the lower
 * envelope of the parabolas (q - i)^2 + f[i] using a stack of intersection
 * points; running it along rows and then columns yields the exact 2D answer.
 *
 * Time: O(rows * cols). Space: O(rows * cols).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Grid = number[][];

const INF = 1e9;

/** Lower-envelope distance transform of one row (or column). */
function edt1d(f: number[]): number[] {
    const n = f.length;
    const d = new Array<number>(n).fill(0);
    const v = new Array<number>(n).fill(0);
    const z = new Array<number>(n + 1).fill(0);
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;

    for (let q = 1; q < n; q += 1) {
        let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
        while (s <= z[k]!) {
            k -= 1;
            s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
        }
        k += 1;
        v[k] = q;
        z[k] = s;
        z[k + 1] = Infinity;
    }

    k = 0;
    for (let q = 0; q < n; q += 1) {
        while (z[k + 1]! < q) {
            k += 1;
        }
        const delta = q - v[k]!;
        d[q] = delta * delta + f[v[k]!]!;
    }
    return d;
}

/** Full two-pass transform; result[r][c] is squared distance to nearest feature. */
function edt2d(grid: Grid, rows: number, cols: number): number[][] {
    const temp: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const f = new Array<number>(cols).fill(INF);
        for (let c = 0; c < cols; c += 1) {
            if (grid[r]?.[c]) {
                f[c] = 0;
            }
        }
        temp.push(edt1d(f));
    }
    const result: number[][] = [];
    for (let r = 0; r < rows; r += 1) result.push(new Array<number>(cols).fill(0));
    for (let c = 0; c < cols; c += 1) {
        const column = new Array<number>(rows).fill(0);
        for (let r = 0; r < rows; r += 1) column[r] = temp[r]![c]!;
        const transformed = edt1d(column);
        for (let r = 0; r < rows; r += 1) result[r]![c] = transformed[r]!;
    }
    return result;
}

function cellNode(
    r: number,
    c: number,
    label: string,
    state: EntityState,
): VisualEntity {
    return {
        id: `c-${r}-${c}`,
        type: "node",
        label,
        value: label,
        state,
        x: c,
        y: -r,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}

/** The distance-transform generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: Grid } | null) ?? {};
    const grid: Grid = task.grid ?? [
        [1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1],
    ];
    const rows = grid.length;
    const cols = rows > 0 ? Math.max(...grid.map((row) => row.length)) : 0;
    let step = 0;
    const emit = (
        labels: string[][],
        stateOf: (r: number, c: number) => EntityState,
        description: string,
        codeLineNumber: number,
        dist: number[][],
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                entities.push(cellNode(r, c, labels[r]?.[c] ?? "0", stateOf(r, c)));
            }
        }
        const flat: number[] = [];
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) flat.push(dist[r]?.[c] ?? 0);
        }
        return {
            stepNumber: step++,
            entities,
            edges: [],
            description,
            codeLineNumber,
            layout: "point",
            meta: { dist2: flat, rows, cols },
        };
    };

    if (rows === 0 || cols === 0) {
        yield emit([], () => "unvisited", "Exact EDT: empty image has no pixels to transform.", 0, []);
        return;
    }

    const initial: string[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: string[] = [];
        for (let c = 0; c < cols; c += 1) row.push(grid[r]?.[c] ? "1" : "0");
        initial.push(row);
    }
    const zeros: number[][] = [];
    for (let r = 0; r < rows; r += 1) zeros.push(new Array<number>(cols).fill(0));
    yield emit(initial, () => "unvisited", `Exact EDT: ${rows} by ${cols} image with ${initial.flat().filter((v) => v === "1").length} features.`, 0, zeros);

    const temp: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const f = new Array<number>(cols).fill(INF);
        for (let c = 0; c < cols; c += 1) {
            if (grid[r]?.[c]) f[c] = 0;
        }
        temp.push(edt1d(f));
        const labels = temp.map((row, rr) => row.map((v, cc) => (rr <= r ? String(v >= INF ? 0 : v) : initial[rr]?.[cc] ?? "0")));
        yield emit(
            labels,
            (rr) => (rr === r ? "active" : rr < r ? "visited" : "unvisited"),
            `Exact EDT: row ${r} lower envelope of parabolas complete.`,
            1,
            zeros,
        );
    }

    const result = edt2d(grid, rows, cols);
    for (let c = 0; c < cols; c += 1) {
        const labels = result.map((row) => row.map((v) => String(v)));
        yield emit(
            labels,
            (_r, cc) => (cc === c ? "active" : "visited"),
            `Exact EDT: column ${c} pass gives final squared distances.`,
            3,
            result,
        );
    }

    yield emit(
        result.map((row) => row.map((v) => String(v))),
        (r, c) => (grid[r]?.[c] ? "sorted" : "visited"),
        `Exact EDT: every pixel carries its exact squared distance to a feature.`,
        4,
        result,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The exact Euclidean distance transform labels every background pixel with the squared distance to the closest foreground pixel. Computing all pairs directly is slow, but the distance along a row is the lower envelope of a parabola centered at each feature. A stack keeps only the parabolas that actually appear on that envelope, so one linear pass handles a whole row, and a second pass over columns makes the answer two-dimensional.",
        invariants: [
            "Feature pixels always have squared distance zero.",
            "The parabola stack is ordered by increasing intersection abscissa.",
            "After the column pass each pixel holds the squared distance to a feature in some row and column.",
        ],
        correctness:
            "For a fixed column, the row pass computes min over source columns i of (q - i)^2 + f[i], which is exactly the lower envelope of those parabolas; the stack algorithm finds the minimum for every q because intersection points are monotone. Applying the same argument to columns of the row result composes the two one-dimensional minima into a global minimum over all feature pixels, so the value returned is the true squared Euclidean distance.",
        complexityRationale:
            "Each one-dimensional pass pushes and pops every index at most once, so a row or column costs linear time. Two passes over an image with r rows and c columns take O(r c) time and O(r c) space for the stored images.",
        uses: [
            "Distance fields for collision avoidance and path planning",
            "Shape skeletons, medial axes, and morphological operations",
            "Fast nearest-feature queries in image segmentation",
        ],
        references: [
            "Felzenszwalb and Huttenlocher, Distance Transforms of Sampled Functions, 2012",
            "Borgefors, Distance Transformations in Digital Images, 1986",
        ],
        workedExample:
            "On a row [1, 0, 0, 0, 1] the feature parabolas sit at columns 0 and 4. The lower envelope gives squared distances [0, 1, 4, 1, 0]. Repeating the pass down the columns of a small image yields the squared distance from every cell to the nearest of the original ones.",
    },
    id: "felzenszwalb-huttenlocher-edt",
    name: "Felzenszwalb-Huttenlocher Distance Transform",
    category: "geometry",
    complexity: { time: "O(rc)", space: "O(rc)" },
    defaultInput: {
        grid: [
            [1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "set f to zero at feature pixels and a large value elsewhere",
        "for each row compute the lower envelope of (q minus i) squared plus f of i",
        "keep a stack of the parabolas that lie on that envelope",
        "for each column repeat the envelope pass on the row results",
        "read the squared distance at each pixel from the column results",
        "done: every pixel knows its nearest feature distance squared",
    ],
};

export default module;
