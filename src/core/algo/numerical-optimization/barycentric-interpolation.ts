/**
 * barycentric-interpolation.ts - Barycentric Lagrange Interpolation
 *
 * Lagrange interpolation can be evaluated stably in O(n) once barycentric
 * weights are known. For distinct nodes x_i the weights are the reciprocal of
 * the product of (x_i - x_j) over all j different from i. At a query point x,
 * the interpolant is the ratio of two sums: sum(w_i y_i / (x - x_i)) divided by
 * sum(w_i / (x - x_i)). When x coincides with a node the answer is exactly y_i.
 *
 * Limits of the demo: nodes and values are supplied explicitly and must be
 * distinct; evaluation is done in double precision, which is exact for the
 * low-degree polynomials used by the accompanying test.
 *
 * Time: O(n^2) to build weights for n nodes, O(n) per evaluated query.
 * Space: O(n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

function makeEntities(nodes: Point[], queries: number[], activeQuery: number): VisualEntity[] {
    const pointEntities: VisualEntity[] = nodes.map(([x, y], index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: `x${index}=${x.toFixed(2)}`,
        value: [x, y],
        state: "idle" as const,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, role: "node" },
    }));
    const queryEntities: VisualEntity[] = queries.map((x, index) => ({
        id: `query-${index}`,
        type: "node" as const,
        label: `q${index}=${x.toFixed(2)}`,
        value: [x, 0],
        state: index === activeQuery ? ("highlight" as const) : ("unvisited" as const),
        x,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: "query" },
    }));
    return [...pointEntities, ...queryEntities];
}

/** Reciprocal product weights for distinct nodes. */
function barycentricWeights(xs: number[]): number[] {
    return xs.map((xi, i) => {
        let product = 1;
        for (let j = 0; j < xs.length; j += 1) {
            if (j !== i) {
                product *= xi - (xs[j] as number);
            }
        }
        return 1 / product;
    });
}

/** Evaluate the barycentric interpolant at x, returning [value, usedDirectNode]. */
function evaluate(
    xs: number[],
    ys: number[],
    weights: number[],
    x: number,
): [number, boolean] {
    for (let i = 0; i < xs.length; i += 1) {
        if (x === xs[i]) {
            return [ys[i] as number, true];
        }
    }
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < xs.length; i += 1) {
        const term = (weights[i] as number) / (x - (xs[i] as number));
        numerator += term * (ys[i] as number);
        denominator += term;
    }
    return [numerator / denominator, false];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: Point[]; queries?: number[] } | null) ?? {};
    const nodes: Point[] = task.nodes ?? [
        [-1, 1],
        [-0.5, 0.25],
        [0, 0],
        [0.5, 0.25],
        [1, 1],
    ];
    const queries: number[] = task.queries ?? [-0.75, -0.25, 0.25, 0.75];
    const xs = nodes.map(([x]) => x);
    const ys = nodes.map(([, y]) => y);
    const distinct = xs.every((x, i) => xs.every((other, j) => i === j || x !== other));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(nodes, queries, -1),
        edges: [],
        description: `Received ${nodes.length} interpolation nodes and ${queries.length} query points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { nodeCount: nodes.length, queryCount: queries.length, distinct },
    };
    step += 1;

    if (!distinct || nodes.length === 0) {
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, queries, -1),
            edges: [],
            description: "Interpolation requires at least one node and all node abscissas must be distinct.",
            codeLineNumber: 7,
            layout: "point",
            meta: { distinct: false, valid: false },
        };
        return;
    }

    const weights = barycentricWeights(xs);
    yield {
        stepNumber: step,
        entities: makeEntities(nodes, queries, -1),
        edges: [],
        description: `Computed barycentric weights: [${weights.map((w) => w.toFixed(3)).join(", ")}].`,
        codeLineNumber: 1,
        layout: "point",
        meta: { weights, distinct: true },
    };
    step += 1;

    for (let q = 0; q < queries.length; q += 1) {
        const x = queries[q] as number;
        const [value, direct] = evaluate(xs, ys, weights, x);
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, queries, q),
            edges: [],
            description: `Query ${x.toFixed(4)} evaluates to ${value.toFixed(8)}${direct ? " (exact node value)" : " via the barycentric formula"}.`,
            codeLineNumber: direct ? 3 : 5,
            layout: "point",
            meta: { query: x, value, directNode: direct, queryIndex: q },
        };
        step += 1;
    }

    const allValues = queries.map((x) => evaluate(xs, ys, weights, x)[0]);
    yield {
        stepNumber: step,
        entities: makeEntities(nodes, queries, -1),
        edges: [],
        description: `Evaluated ${queries.length} queries with the barycentric weights; values are [${allValues.map((v) => v.toFixed(4)).join(", ")}].`,
        codeLineNumber: 7,
        layout: "point",
        meta: { values: allValues, weights, distinct: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The ordinary Lagrange formula rebuilds a whole polynomial for every evaluation. The barycentric form reorganizes the same polynomial into two weighted sums using one set of weights that depends only on the nodes. That makes a full sweep of query points cheap and numerically well behaved when the nodes are clustered.",
        invariants: [
            "The barycentric weights depend only on the node positions, not on the data values or queries.",
            "Evaluating at a node returns that node's stored value exactly.",
            "The numerator and denominator use the same weights, so a common scaling of all weights cancels.",
        ],
        correctness:
            "The barycentric formula is an algebraic rearrangement of the unique interpolating polynomial through the nodes. For a query that is not a node, the ratio of the two sums equals that polynomial; the numerator and denominator have the same poles, which cancel. At a node the direct branch returns the defining value, so the interpolant passes through every data point.",
        complexityRationale:
            "Each weight multiplies n-1 factors, so building all n weights takes O(n^2). Evaluating one query loops over all n nodes, giving O(n) per query and O(n) working space.",
        uses: [
            "High-order spectral methods for differential equations",
            "Fast evaluation of interpolants in computer-aided design",
            "Chebyshev node interpolation in numerical analysis libraries",
        ],
        references: [
            "Trefethen, Approximation Theory and Approximation Practice",
            "Berrut and Trefethen, Barycentric Lagrange Interpolation, SIAM Review 2004",
        ],
        workedExample:
            "With nodes -1, 0 and 1 carrying values 1, 0 and 1, the weights are 0.5, -1 and 0.5. At x=0.5 the two sums give numerator -0.25 and denominator -0.5, so the interpolant is 0.5, the exact value of the underlying parabola x squared at that point.",
    },
    id: "barycentric-interpolation",
    name: "Barycentric Interpolation",
    category: "numerical-optimization",
    complexity: { time: "O(n^2 + qn)", space: "O(n)" },
    defaultInput: {
        nodes: [
            [-1, 1],
            [-0.5, 0.25],
            [0, 0],
            [0.5, 0.25],
            [1, 1],
        ],
        queries: [-0.75, -0.25, 0.25, 0.75],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the distinct nodes and their data values",
        "for each node compute the product of differences to all other nodes",
        "set the barycentric weight to the reciprocal of that product",
        "for each query point",
        "if it equals a node, return that node value directly",
        "sum weight times value over x minus node",
        "sum weight over x minus node",
        "divide the first sum by the second to get the interpolant",
    ],
};

export default module;
