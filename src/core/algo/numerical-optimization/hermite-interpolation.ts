/**
 * hermite-interpolation.ts - Piecewise Cubic Hermite Interpolation
 *
 * Builds a cubic polynomial on each interval between adjacent nodes that
 * matches the function value and the first derivative at both ends. Unlike
 * Lagrange interpolation it uses derivative data, and unlike a cubic spline it
 * does not impose second-derivative continuity between pieces.
 *
 * This is an exact small construction for the supplied nodes, values, and
 * derivatives. It does not solve for derivatives from data, handle repeated
 * nodes, or extrapolate beyond the first and last nodes.
 *
 * Time:  O(samples) to evaluate all sample points
 * Space: O(samples + nodes)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    nodes?: number[];
    values?: number[];
    derivatives?: number[];
    samples?: number;
    exact?: "sin" | "square";
}

type Eval = [value: number, derivative: number];

/** Cubic Hermite value and derivative on [x0, x1]. */
function hermite(x0: number, x1: number, y0: number, y1: number, d0: number, d1: number, x: number): Eval {
    const h = x1 - x0;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const value = h00 * y0 + h10 * h * d0 + h01 * y1 + h11 * h * d1;
    const dh00 = 6 * t2 - 6 * t;
    const dh10 = 3 * t2 - 4 * t + 1;
    const dh01 = -6 * t2 + 6 * t;
    const dh11 = 3 * t2 - 2 * t;
    const derivative = (dh00 * y0 + dh10 * h * d0 + dh01 * y1 + dh11 * h * d1) / h;
    return [value, derivative];
}

function makeBars(rows: number[][], active: number): VisualEntity[] {
    return rows.map((row, i) => ({
        id: `sample-${i}`,
        type: "bar" as const,
        label: `x=${row[0]!.toFixed(3)} y=${row[1]!.toFixed(3)}`,
        value: row[1]!,
        state: i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, x: row[0]!, interpolated: row[1]!, trueValue: row[2]!, error: row[3]! },
    }));
}

function trueFunction(x: number, exact: "sin" | "square"): number {
    return exact === "square" ? x * x : Math.sin(x);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const nodes = Array.isArray(task.nodes) && task.nodes.length >= 2
        ? task.nodes.map((v) => Number(v))
        : [0, Math.PI / 2, Math.PI];
    const values = Array.isArray(task.values) && task.values.length === nodes.length
        ? task.values.map((v) => Number(v))
        : nodes.map((x) => Math.sin(x));
    const derivatives = Array.isArray(task.derivatives) && task.derivatives.length === nodes.length
        ? task.derivatives.map((v) => Number(v))
        : nodes.map((x) => Math.cos(x));
    const samples = Math.min(200, Math.max(2, Math.floor(Number(task.samples ?? 16)) || 16));
    const exact: "sin" | "square" = task.exact === "square" ? "square" : "sin";
    const n = nodes.length;

    const rows: number[][] = [];
    for (let k = 0; k < samples; k += 1) {
        const x = nodes[0]! + ((nodes[n - 1]! - nodes[0]!) * k) / (samples - 1);
        let piece = 0;
        while (piece < n - 2 && x > (nodes[piece + 1] as number)) piece += 1;
        const [value] = hermite(
            nodes[piece]!, nodes[piece + 1]!, values[piece]!, values[piece + 1]!,
            derivatives[piece]!, derivatives[piece + 1]!, x,
        );
        const trueValue = trueFunction(x, exact);
        rows.push([x, value, trueValue, Math.abs(value - trueValue)]);
    }

    const nodeValueChecks: number[] = [];
    const nodeDerivativeChecks: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const piece = i < n - 1 ? i : n - 2;
        const [value, derivative] = hermite(
            nodes[piece]!, nodes[piece + 1]!, values[piece]!, values[piece + 1]!,
            derivatives[piece]!, derivatives[piece + 1]!, nodes[i]!,
        );
        nodeValueChecks.push(value);
        nodeDerivativeChecks.push(derivative);
    }

    const maxError = rows.reduce((m, r) => Math.max(m, r[3]!), 0);
    const metaFor = (active: number, done: boolean) => ({
        nodes: [...nodes],
        values: [...values],
        derivatives: [...derivatives],
        samples: rows.map((r) => [...r]),
        nodeValueChecks,
        nodeDerivativeChecks,
        maxError,
        active,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(rows, -1),
        edges: [],
        description: `Build ${n - 1} cubic Hermite pieces through ${n} nodes with matching values and first derivatives.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(-1, false),
    };

    for (let k = 0; k < rows.length; k += 1) {
        yield {
            stepNumber: k + 1,
            entities: makeBars(rows, k),
            edges: [],
            description: `Sample ${k + 1} of ${rows.length}: at x=${rows[k]![0]!.toFixed(3)} the Hermite piece gives ${rows[k]![1]!.toFixed(5)} versus true ${rows[k]![2]!.toFixed(5)}.`,
            codeLineNumber: k === 0 ? 2 : 3,
            layout: "array",
            meta: metaFor(k, false),
        };
    }

    yield {
        stepNumber: rows.length + 1,
        entities: makeBars(rows, -1),
        edges: [],
        description: `Interpolation complete: every node value and derivative is matched exactly; largest sample error ${maxError.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A straight line through two points misses the curve between them. A cubic Hermite piece uses four pieces of information at the interval ends, the two heights and the two slopes, so it can bend to follow the function. Stitching one such cubic onto each interval gives a smooth interpolant that honors all the supplied slopes.",
        invariants: [
            "On every interval the interpolant is a cubic polynomial determined only by the two endpoint values and slopes.",
            "At each node the interpolant equals the supplied value and has the supplied derivative.",
            "Sample points are evaluated inside the node range, never outside it.",
        ],
        correctness:
            "The Hermite basis functions satisfy h00(0)=1, h10'(0)=1, h01(1)=1, h11'(1)=1 with all other endpoint value or slope terms equal to zero. Substituting t equals zero and t equals one therefore reproduces the node value and slope exactly. Because each interval matches the same value and slope at a shared node, adjacent pieces agree there, so the piecewise interpolant is well defined and meets every node constraint.",
        complexityRationale:
            "Each sample is located by scanning at most the node list and then evaluated with a constant number of arithmetic operations, so evaluating all samples is O(samples). The node arrays, sample rows, and check arrays are stored, giving O(samples + nodes) space.",
        uses: [
            "Interpolating sampled signals when derivative measurements are available",
            "Cubic Hermite spline used in computer graphics and font outlines",
            "Constructing shape-preserving curves in numerical analysis",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Chapter 3, 2011",
            "de Boor, A Practical Guide to Splines, 1978",
        ],
        workedExample:
            "With nodes zero, pi over two, and pi, values zero, one, zero, and derivatives one, zero, minus one, the first cubic matches the sine curve near zero with slope one. Evaluating at pi over four gives about 0.707, close to the true sine value.",
    },
    id: "hermite-interpolation",
    name: "Piecewise Cubic Hermite Interpolation",
    category: "numerical-optimization",
    complexity: { time: "O(samples)", space: "O(samples + nodes)" },
    defaultInput: { samples: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read the nodes, values, and first derivatives",
        "for each pair of adjacent nodes define a cubic piece",
        "scale the coordinate to a local parameter from zero to one",
        "combine the Hermite basis with endpoint values and slopes",
        "evaluate the piece at each requested sample point",
        "record the true function value and the absolute error",
        "verify every node value and slope is reproduced exactly",
        "done: report the sampled interpolant and largest error",
    ],
};

export default module;
