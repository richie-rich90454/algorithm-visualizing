/**
 * kolmogorov-arnold-network.ts - KAN Edge Spline and Layer Sum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Kolmogorov-Arnold Network replaces fixed linear weights on edges with
 * learnable univariate functions, usually piecewise-linear splines. The
 * teachable core is one KAN layer: the output is the sum over incoming edges of
 * a spline applied to each input feature. This module draws each spline as its
 * knot points plus the interpolated query point, then accumulates the layer
 * output. It is a small teaching model of the spline computation, not a trained
 * network or a full KAN implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(edges * knots) with a linear scan for the containing segment
 *   Space: O(knots) for one spline's displayed points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Knot points of the current edge are drawn as nodes in the plane.
 *   - The interpolated query point is ACTIVE; knots are SORTED.
 *   - The edge index, its spline value, and the running sum are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KanInput {
    knots?: number[];
    values?: number[][];
    x?: number[];
}

/** Piecewise-linear interpolation of one spline at a query point. */
function interpolate(knots: number[], row: number[], x: number): number {
    if (knots.length === 0 || row.length === 0) {
        return 0;
    }
    const first = knots[0] ?? 0;
    const last = knots[knots.length - 1] ?? 1;
    const clamped = Math.min(last, Math.max(first, x));
    if (knots.length === 1) {
        return row[0] ?? 0;
    }
    for (let j = 0; j < knots.length - 1; j += 1) {
        const left = knots[j] ?? 0;
        const right = knots[j + 1] ?? left + 1;
        if (clamped >= left && clamped <= right) {
            const width = right - left;
            if (width === 0) {
                return row[j + 1] ?? 0;
            }
            const t = (clamped - left) / width;
            return (row[j] ?? 0) + t * ((row[j + 1] ?? 0) - (row[j] ?? 0));
        }
    }
    return row[row.length - 1] ?? 0;
}

/** Build the knot and query points for one edge. */
function makePoints(knots: number[], row: number[], x: number, phi: number): VisualEntity[] {
    const points: VisualEntity[] = knots.map((knot, index) => ({
        id: `knot-${index}`,
        type: "node" as const,
        label: `(${knot}, ${row[index] ?? 0})`,
        value: row[index] ?? 0,
        state: "sorted" as const,
        x: knot,
        y: row[index] ?? 0,
        width: 0,
        height: 0,
        metadata: { index, edge: "knot" },
    }));
    const query: VisualEntity = {
        id: "query-point",
        type: "node" as const,
        label: `x=${x}, phi=${phi.toFixed(3)}`,
        value: phi,
        state: "active" as const,
        x: Math.min(knots[knots.length - 1] ?? 1, Math.max(knots[0] ?? 0, x)),
        y: phi,
        width: 0,
        height: 0,
        metadata: { index: knots.length, edge: "query" },
    };
    return [...points, query];
}

/** Run one KAN layer over its incoming edges. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KanInput | null) ?? {};
    const knots = Array.isArray(task.knots) && task.knots.length > 0 ? task.knots : [0, 0.5, 1];
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values
        : [[0, 1, 0], [1, 0, 1]];
    const x = Array.isArray(task.x) && task.x.length > 0 ? task.x : [0.25, 0.75];
    let output = 0;
    let step = 0;
    let edge = -1;

    const frame = (description: string, codeLineNumber: number, phi: number): VisualFrame => {
        const row = values[Math.max(0, Math.min(edge, values.length - 1))] ?? knots.map(() => 0);
        const query = edge >= 0 ? (x[edge] ?? 0) : 0;
        return {
            stepNumber: step++,
            entities: makePoints(knots, row, query, phi),
            edges: [],
            description,
            codeLineNumber,
            layout: "point",
            meta: { edges: values.length, edge, knots: knots.length, phi, output, x: query },
        };
    };

    yield frame(`One KAN layer sums ${values.length} learned spline(s) over ${x.length} input feature(s).`, 0, 0);

    for (let i = 0; i < Math.min(values.length, x.length); i += 1) {
        edge = i;
        const row = values[i] ?? [];
        const phi = interpolate(knots, row, x[i] ?? 0);
        output += phi;
        yield frame(
            `Edge ${i}: spline at x = ${x[i]} gives phi = ${phi.toFixed(3)}; running layer sum = ${output.toFixed(3)}.`,
            2,
            phi,
        );
    }

    yield frame(`KAN layer output = ${output.toFixed(3)} after summing every edge spline.`, 5, 0);
}

/** The KAN teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A KAN moves the learnable function onto the connections: every edge carries a small spline instead of a single weight. To evaluate the layer, apply each edge's spline to its input feature and add the results. The visualization shows one spline at a time as knots in the plane with the query point sliding along the fitted segments.",
        invariants: [
            "A spline interpolates linearly between neighboring knots.",
            "At a knot the spline value equals the stored knot value exactly.",
            "The layer output is the sum of all edge spline values.",
        ],
        correctness:
            "On the segment between knot j and knot j+1, linear interpolation reproduces the straight line through the two knot values, so it passes through every knot and is continuous. Summing those edge values implements the Kolmogorov-Arnold representation of the layer; a test checks the interpolated values against an independent computation and verifies the knot property.",
        complexityRationale:
            "Finding the containing segment by scanning the knots costs O(knots) per edge, giving O(edges * knots) time. Only the knot list and one query point are kept for the display, so extra space is O(knots).",
        uses: [
            "Interpretable function approximation where edge functions can be inspected",
            "Scientific machine learning and symbolic regression",
            "A drop-in alternative to multilayer perceptrons",
        ],
        references: [
            "Liu et al., KAN: Kolmogorov-Arnold Networks, 2024",
            "Kolmogorov, On the Representation of Continuous Functions of Several Variables, 1956",
        ],
        workedExample:
            "With knots 0, 0.5, 1 and edge values 0, 1, 0, the query x = 0.25 lies halfway between 0 and 0.5, so the spline returns 0.5. A second edge with values 1, 0, 1 at x = 0.75 also returns 0.5, making the layer output 1.0.",
    },
    id: "kolmogorov-arnold-network",
    name: "Kolmogorov-Arnold Network (Spline Core)",
    category: "ml-ai",
    complexity: { time: "O(edges * knots)", space: "O(knots)" },
    defaultInput: { knots: [0, 0.5, 1], values: [[0, 1, 0], [1, 0, 1]], x: [0.25, 0.75] },
    visualType: "point",
    run,
    pseudocode: [
        "store knots and learned values for every edge spline",
        "initialize the layer output to zero",
        "for each input feature and its edge",
        "find the knot segment containing the feature value",
        "linearly interpolate the spline value inside that segment",
        "add the spline value to the layer output",
        "done: report the summed layer output",
    ],
};

export default module;
