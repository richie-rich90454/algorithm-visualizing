/**
 * spectral-graph-partitioning.ts - Fiedler Vector Spectral Bisection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The second-smallest eigenvalue of the graph Laplacian has an eigenvector
 * (the Fiedler vector) whose signs reveal a low-cost way to split the graph
 * into two groups. Power iteration on a shifted Laplacian, with the constant
 * eigenvector removed at every step, converges to that vector. Vertices with
 * a positive component go to one side and the rest go to the other; edges
 * crossing the split form the cut.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * (V + E)) for t dense matrix-vector iterations
 *   Space: O(V^2) for the shifted Laplacian in this reference implementation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their current Fiedler component and are colored by sign.
 *   - Edges crossing the final split are ORANGE.
 *   - meta reports the cut size, the eigenvalue estimate, and the residual.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Adj; maxIterations?: number } | null) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B", "D", "E"],
        D: ["A", "C", "F"],
        E: ["C", "F"],
        F: ["D", "E"],
    };
    const vertices = Object.keys(adjacency).sort();
    const maxIterations =
        typeof task.maxIterations === "number" ? Math.max(1, Math.floor(task.maxIterations)) : 240;
    const edgeList: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const b of adjacency[a] ?? []) {
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            edgeList.push([a, b]);
        }
    }
    let step = 0;
    const makeEdges = (cut: Set<string>): Array<{
        id: string;
        sourceId: string;
        targetId: string;
        label: string;
        state: EntityState;
        directed: boolean;
    }> =>
        edgeList.map(([a, b]) => ({
            id: `edge-${[a, b].sort().join("-")}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: cut.has([a, b].sort().join("|")) ? ("swapped" as const) : ("idle" as const),
            directed: false,
        }));
    const snap = (
        description: string,
        line: number,
        states: Map<string, EntityState>,
        values: Map<string, number> | null,
        cut: Set<string>,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => {
        const nodes = makeGraphNodes(vertices);
        for (const n of nodes) {
            const v = String(n.value);
            n.state = states.get(v) ?? "unvisited";
            if (values?.has(v)) n.label = (values.get(v) as number).toFixed(2);
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges: makeEdges(cut),
            description,
            codeLineNumber: line,
            layout: "graph" as const,
            meta,
        };
    };

    if (vertices.length === 0) {
        yield snap("Empty graph - there is no cut to find.", 0, new Map(), null, new Set(), {
            cutSize: 0,
            iterations: 0,
        });
        return;
    }

    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));
    const degrees = new Array<number>(n).fill(0);
    for (const [a, b] of edgeList) {
        degrees[index.get(a) as number] += 1;
        degrees[index.get(b) as number] += 1;
    }
    const alpha = 2 * Math.max(1, ...degrees) + 1;
    const M: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? alpha - (degrees[i] as number) : 0)),
    );
    for (const [a, b] of edgeList) {
        const i = index.get(a) as number;
        const j = index.get(b) as number;
        M[i]![j] = (M[i]![j] as number) + 1;
        M[j]![i] = (M[j]![i] as number) + 1;
    }

    yield snap(
        `Built a ${n}-vertex Laplacian and shifted it by ${alpha} for power iteration.`,
        0,
        new Map(),
        null,
        new Set(),
        { cutSize: 0, iterations: 0, alpha },
    );
    step += 1;

    let f: number[] = vertices.map((_, i) => Math.sin(i + 1) + 0.3 * Math.cos(2 * i + 1));
    const removeMean = (vec: number[]): void => {
        const mean = vec.reduce((s, x) => s + x, 0) / vec.length;
        for (let i = 0; i < vec.length; i += 1) vec[i] = (vec[i] as number) - mean;
    };
    removeMean(f);
    let iterations = 0;
    for (let iter = 0; iter < maxIterations; iter += 1) {
        iterations = iter + 1;
        const g = new Array<number>(n).fill(0);
        for (let i = 0; i < n; i += 1) {
            let sum = 0;
            for (let j = 0; j < n; j += 1) sum += (M[i]![j] as number) * (f[j] as number);
            g[i] = sum;
        }
        removeMean(g);
        const norm = Math.sqrt(g.reduce((s, x) => s + x * x, 0));
        if (norm < 1e-14) break;
        const next = g.map((x) => x / norm);
        let delta = 0;
        for (let i = 0; i < n; i += 1) delta = Math.max(delta, Math.abs((next[i] as number) - (f[i] as number)));
        f = next;
        if (iter % 40 === 0 || delta < 1e-11) {
            const values = new Map(vertices.map((v, i) => [v, f[i] as number]));
            const states = new Map<string, EntityState>(
                vertices.map((v) => [v, (f[index.get(v) as number] as number) >= 0 ? "sorted" : "active"]),
            );
            yield snap(
                `Iteration ${iterations}: Fiedler estimate updated (max change ${delta.toExponential(1)}).`,
                3,
                states,
                values,
                new Set(),
                { cutSize: 0, iterations, maxChange: delta },
            );
            step += 1;
        }
        if (delta < 1e-11) break;
    }

    let side = f.map((x) => x >= 0);
    const countA = side.filter(Boolean).length;
    if (countA === 0 || countA === n) {
        const order = [...f.keys()].sort((a, b) => (f[a] as number) - (f[b] as number));
        side = new Array<boolean>(n).fill(false);
        for (let k = 0; k < Math.floor(n / 2); k += 1) side[order[k] as number] = true;
    }

    const cut = new Set<string>();
    let cutSize = 0;
    for (const [a, b] of edgeList) {
        if (side[index.get(a) as number] !== side[index.get(b) as number]) {
            cut.add([a, b].sort().join("|"));
            cutSize += 1;
        }
    }
    const Lf = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        Lf[i] = degrees[i]! * (f[i] as number);
        for (const [a, b] of edgeList) {
            const ia = index.get(a) as number;
            const ib = index.get(b) as number;
            if (ia === i) Lf[i] = (Lf[i] as number) - (f[ib] as number);
            else if (ib === i) Lf[i] = (Lf[i] as number) - (f[ia] as number);
        }
    }
    const fnorm = f.reduce((s, x) => s + x * x, 0);
    const lambda = fnorm > 0 ? f.reduce((s, x, i) => s + x * (Lf[i] as number), 0) / fnorm : 0;
    let residual = 0;
    for (let i = 0; i < n; i += 1)
        residual = Math.max(residual, Math.abs((Lf[i] as number) - lambda * (f[i] as number)));

    const states = new Map<string, EntityState>();
    const values = new Map<string, number>();
    for (let i = 0; i < n; i += 1) {
        states.set(vertices[i] as string, side[i] ? "sorted" : "active");
        values.set(vertices[i] as string, f[i] as number);
    }
    yield snap(
        `Split into groups of ${side.filter(Boolean).length} and ${n - side.filter(Boolean).length} vertices with a cut of ${cutSize} edge(s).`,
        7,
        states,
        values,
        cut,
        {
            cutSize,
            iterations,
            lambda,
            residual,
            sideA: vertices.filter((_, i) => side[i]).join(","),
            sideB: vertices.filter((_, i) => !side[i]).join(","),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A graph's Laplacian measures how much each vertex differs from its neighbors. Its second eigenvector changes sign across a natural weak link in the graph. Sort vertices by that sign and the edges that cross from positive to negative form a small cut, which is the heart of spectral partitioning.",
        invariants: [
            "The iterated vector is orthogonal to the all-ones vector after every step.",
            "The shifted Laplacian is positive semidefinite, so its largest eigenvalue corresponds to the smallest Laplacian eigenvalue.",
            "Every vertex is assigned to exactly one of the two sides.",
        ],
        correctness:
            "The constant vector is the Laplacian eigenvector for eigenvalue zero. Shifting makes it the dominant eigenvector of the iteration matrix; removing the mean at each step suppresses it so the iteration converges to the eigenvector of the second-smallest Laplacian eigenvalue. The Rayleigh quotient of that vector is the algebraic connectivity, and the sign split is a discrete relaxation of the minimum bisection, so crossing edges are exactly those the relaxed solution wants to cut.",
        complexityRationale:
            "Each dense matrix-vector product costs O(V^2), and the graph is also scanned when computing the cut, giving O(t * V^2) time in this straightforward implementation; storing the shifted Laplacian uses O(V^2) space.",
        uses: [
            "Dividing integrated circuits into balanced blocks",
            "Finding communities in social and biological networks",
            "Prepartitioning meshes for parallel finite-element solvers",
        ],
        references: [
            "Fiedler, Algebraic Connectivity of Graphs, 1973",
            "Shi and Malik, Normalized Cuts and Image Segmentation, 2000",
        ],
        workedExample:
            "Two triangles joined by a single bridge have a Fiedler vector that is positive on one triangle and negative on the other. The sign split cuts only the bridge, so the reported cut size is one even though each triangle is internally dense.",
    },
    id: "spectral-graph-partitioning",
    name: "Spectral Graph Partitioning (Fiedler Bisection)",
    category: "graph",
    complexity: { time: "O(t V^2)", space: "O(V^2)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B", "D", "E"],
            D: ["A", "C", "F"],
            E: ["C", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the graph Laplacian from degrees and adjacency",
        "shift the Laplacian so iteration is numerically stable",
        "initialize a vector orthogonal to the all-ones vector",
        "repeat: multiply by the shifted Laplacian",
        "remove the constant component and normalize",
        "stop when the vector barely changes",
        "split vertices by the sign of their component",
        "count the edges crossing between the two sides",
        "done: report the Fiedler cut and eigenvalue estimate",
    ],
};

export default module;
