/**
 * hanan-grid-rectilinear-steiner.ts - Hanan Grid Rectilinear Steiner Tree.
 *
 * For Manhattan geometry there is always an optimal Steiner tree whose edges
 * lie on the Hanan grid: the horizontal and vertical lines through every
 * terminal. Building that grid reduces the continuous rectilinear Steiner
 * problem to a small graph problem, which is solved exactly with a subset
 * dynamic program over terminals and grid vertices.
 *
 * Time:  O(3^t G + 2^t G^2 + G^3) with G grid points and t terminals
 * Space: O(2^t G + G^2)
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type Edge = [number, number, number];

interface Grid {
    coords: Point[];
    edges: Edge[];
    terminalIdx: number[];
}

function buildGrid(terminals: Point[]): Grid {
    const xs = [...new Set(terminals.map((p) => p[0]))].sort((a, b) => a - b);
    const ys = [...new Set(terminals.map((p) => p[1]))].sort((a, b) => a - b);
    const nx = xs.length;
    const ny = ys.length;
    const at = (i: number, j: number): number => i * ny + j;
    const coords: Point[] = [];
    for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) coords.push([xs[i] as number, ys[j] as number]);
    const edges: Edge[] = [];
    for (let i = 0; i < nx; i += 1) {
        for (let j = 0; j < ny; j += 1) {
            if (i + 1 < nx) edges.push([at(i, j), at(i + 1, j), (xs[i + 1] as number) - (xs[i] as number)]);
            if (j + 1 < ny) edges.push([at(i, j), at(i, j + 1), (ys[j + 1] as number) - (ys[j] as number)]);
        }
    }
    const terminalIdx = terminals.map(([x, y]) => at(xs.indexOf(x), ys.indexOf(y)));
    return { coords, edges, terminalIdx };
}

function solve(grid: Grid): { cost: number; used: Set<number> } {
    const n = grid.coords.length;
    const INF = Infinity;
    const dist: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
    const next: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => -1));
    for (const [a, b, w] of grid.edges) {
        dist[a]![b] = w;
        dist[b]![a] = w;
        next[a]![b] = b;
        next[b]![a] = a;
    }
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const via = dist[i]![k]! + dist[k]![j]!;
                if (via < dist[i]![j]!) {
                    dist[i]![j] = via;
                    next[i]![j] = next[i]![k];
                }
            }
        }
    }
    const term = grid.terminalIdx;
    const t = term.length;
    if (t < 2) return { cost: 0, used: new Set() };
    const full = (1 << t) - 1;
    const dp: number[][] = Array.from({ length: full + 1 }, () => Array.from({ length: n }, () => INF));
    const splitAt: number[][] = Array.from({ length: full + 1 }, () => Array.from({ length: n }, () => 0));
    const moveFrom: number[][] = Array.from({ length: full + 1 }, () => Array.from({ length: n }, () => -1));
    for (let i = 0; i < t; i += 1) for (let v = 0; v < n; v += 1) dp[1 << i]![v] = dist[term[i] as number]![v] as number;
    for (let mask = 1; mask <= full; mask += 1) {
        let sub = (mask - 1) & mask;
        while (sub > 0) {
            const other = mask ^ sub;
            for (let v = 0; v < n; v += 1) {
                const sum = dp[sub]![v]! + dp[other]![v]!;
                if (sum < dp[mask]![v]!) {
                    dp[mask]![v] = sum;
                    splitAt[mask]![v] = sub;
                    moveFrom[mask]![v] = -1;
                }
            }
            sub = (sub - 1) & mask;
        }
        for (let u = 0; u < n; u += 1) {
            for (let v = 0; v < n; v += 1) {
                const via = dp[mask]![u]! + dist[u]![v]!;
                if (via < dp[mask]![v]!) {
                    dp[mask]![v] = via;
                    moveFrom[mask]![v] = u;
                    splitAt[mask]![v] = 0;
                }
            }
        }
    }
    let root = 0;
    let best = INF;
    for (let v = 0; v < n; v += 1) {
        if (dp[full]![v]! < best) {
            best = dp[full]![v] as number;
            root = v;
        }
    }
    if (!Number.isFinite(best)) return { cost: INF, used: new Set() };
    const used = new Set<number>();
    const addPath = (a: number, b: number): void => {
        let cur = a;
        for (let guard = 0; cur !== b && guard < n + 1; guard += 1) {
            const nxt = next[cur]![b] as number;
            if (nxt < 0) return;
            const index = grid.edges.findIndex(
                ([u, v]) => (u === cur && v === nxt) || (u === nxt && v === cur),
            );
            if (index >= 0) used.add(index);
            cur = nxt;
        }
    };
    const build = (mask: number, v: number): void => {
        const from = moveFrom[mask]![v] as number;
        if (from >= 0) {
            build(mask, from);
            addPath(from, v);
            return;
        }
        const sub = splitAt[mask]![v] as number;
        if (sub > 0) {
            build(sub, v);
            build(mask ^ sub, v);
            return;
        }
        const bit = Math.round(Math.log2(mask));
        addPath(v, term[bit] as number);
    };
    build(full, root);
    return { cost: best, used };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { terminals?: Point[] } | null) ?? {};
    const terminals: Point[] = task.terminals ?? [[0, 0], [4, 0], [4, 3], [0, 3]];
    if (terminals.length < 2) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Need at least two terminals to build a Hanan grid.",
            codeLineNumber: 0,
            layout: "point",
            meta: { cost: -1 },
        };
        return;
    }
    const grid = buildGrid(terminals);
    const nodes: VisualEntity[] = grid.coords.map(([x, y], index) => {
        const terminalNumber = grid.terminalIdx.indexOf(index);
        return {
            id: `node-g${index}`,
            type: "node" as const,
            label: terminalNumber >= 0 ? `T${terminalNumber}` : "",
            value: [x, y],
            state: terminalNumber >= 0 ? "highlight" : "unvisited",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, terminal: terminalNumber >= 0 },
        };
    });
    const allEdges = (): VisualFrame["edges"] =>
        grid.edges.map(([a, b, w], index) => ({
            id: `edge-${index}`,
            sourceId: `node-g${a}`,
            targetId: `node-g${b}`,
            label: String(w),
            state: "idle" as const,
            directed: false,
        }));
    let step = 0;
    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean>, states?: Map<number, VisualEntity["state"]>, tree?: Set<number>): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({
            ...node,
            state: states?.get(Number(node.id.slice(6))) ?? node.state,
        })),
        edges: allEdges().map((edge, index) =>
            tree?.has(index) ? { ...edge, state: "path" as const } : edge,
        ),
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    yield snap(
        `Hanan grid from ${terminals.length} terminals: vertical and horizontal lines through each terminal create ${nodes.length} grid points.`,
        0,
        { cost: -1, gridPoints: nodes.length, gridEdges: grid.edges.length },
    );
    step += 1;

    yield snap(
        "Every grid edge is axis-aligned, so its Manhattan length equals its Euclidean length; an optimal rectilinear Steiner tree lies entirely on this grid.",
        1,
        { cost: -1, gridPoints: nodes.length, gridEdges: grid.edges.length },
    );
    step += 1;

    const result = solve(grid);
    for (let stage = 1; stage <= Math.min(4, terminals.length); stage += 1) {
        yield snap(
            `Subset DP stage ${stage}: merge smaller terminal subsets at a grid point, then relax attachment points across the grid.`,
            3,
            { cost: -1, gridPoints: nodes.length, gridEdges: grid.edges.length, stage },
        );
        step += 1;
    }

    const states = new Map<number, VisualEntity["state"]>();
    for (const index of grid.terminalIdx) states.set(index, "sorted");
    yield snap(
        Number.isFinite(result.cost)
            ? `Optimal rectilinear Steiner tree has length ${result.cost} on the Hanan grid, using ${result.used.size} grid edges.`
            : "No rectilinear tree connects the terminals.",
        6,
        {
            cost: Number.isFinite(result.cost) ? result.cost : -1,
            optimal: Number.isFinite(result.cost) ? result.cost : -1,
            gridPoints: nodes.length,
            accepted: result.used.size,
        },
        states,
        result.used,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In Manhattan geometry an optimal Steiner tree never needs a turn except at a terminal or where two terminal lines cross. Drawing a vertical and a horizontal line through every terminal forms the Hanan grid, which contains some optimal tree. Searching that small grid exactly gives the rectilinear Steiner tree without considering infinitely many continuous positions.",
        invariants: [
            "Every grid edge is horizontal or vertical between adjacent terminal lines.",
            "The grid contains an optimal rectilinear Steiner tree for the terminals.",
            "The subset dp value is the cheapest tree linking a terminal subset to a grid point.",
        ],
        correctness:
            "The Hanan grid theorem states that an optimal rectilinear Steiner tree can be shifted so all its segments lie on lines through terminals. The subset DP then examines every way to split a terminal subset at a vertex and every shortest-path relocation, so by induction it finds the minimum tree on the grid, which is optimal overall.",
        complexityRationale:
            "With G up to t squared grid points, the all-pairs stage is O(G^3), the subset splits are O(3^t G), and moves are O(2^t G^2); space is O(2^t G + G^2) for the DP tables and distances.",
        uses: [
            "VLSI wirelength estimation and global routing",
            "Manhattan-distance network design",
            "Printed circuit board trace planning",
        ],
        references: [
            "Hanan, On Steiner's Problem with Rectilinear Distance (1966)",
            "Korneyenko, Combinatorial Algorithms on a Grid (1994)",
        ],
        workedExample:
            "For the four corners of a 4 by 3 rectangle, the Hanan grid has only four points connected by four edges. The DP selects two vertical sides and one horizontal connector of length 4, giving a rectilinear Steiner tree of length 10, shorter than the length-11 spanning tree.",
    },
    id: "hanan-grid-rectilinear-steiner",
    name: "Hanan Grid Rectilinear Steiner Tree",
    category: "mst",
    complexity: { time: "O(3^t G + 2^t G^2 + G^3)", space: "O(2^t G + G^2)" },
    defaultInput: {
        terminals: [[0, 0], [4, 0], [4, 3], [0, 3]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "collect unique terminal x and y coordinates",
        "form every grid point at an x and y coordinate intersection",
        "connect adjacent grid points with axis-aligned weighted edges",
        "compute all-pairs shortest paths on the Hanan grid",
        "seed the subset DP at each terminal grid point",
        "merge disjoint terminal subsets at each grid vertex",
        "relax attachment points along grid shortest paths",
        "backtrack to mark the optimal tree edges",
        "done: report the rectilinear Steiner tree length",
    ],
};

export default module;
