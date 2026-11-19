/**
 * powell-method.ts - Powell's Conjugate Direction Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Powell's method is a derivative-free optimizer that searches along a set of
 * directions, then replaces one of them with the net displacement of a full
 * sweep. For a quadratic objective those displacement directions are conjugate,
 * so the method reaches the minimum in a small number of sweeps without ever
 * evaluating a gradient. A golden-section line search finds the minimum along
 * each direction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n * lineSearchSteps * evaluationCost)
 *   Space: O(n) for the current point and direction set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points trace the iterate after each sweep in the search plane.
 *   - The best point so far is green; earlier points are idle.
 *   - meta carries the current point, objective value, and value history.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export type ObjectiveName = "quadratic" | "sphere" | "rosenbrock";

/** Evaluate a built-in two-dimensional teaching objective. */
export function objective(name: ObjectiveName, x: number, y: number): number {
    switch (name) {
        case "sphere":
            return x * x + y * y;
        case "rosenbrock": {
            const a = 1 - x;
            const b = y - x * x;
            return a * a + 100 * b * b;
        }
        case "quadratic":
        default:
            return (x - 1) * (x - 1) + 2 * (y - 2) * (y - 2);
    }
}

const PHI = (Math.sqrt(5) - 1) / 2;

/** Golden-section minimization of f along a direction from a point. */
function lineSearch(f: (p: number[]) => number, x: number[], d: number[]): number[] {
    let lo = -20;
    let hi = 20;
    let c = hi - PHI * (hi - lo);
    let e = lo + PHI * (hi - lo);
    const at = (t: number): number => f(x.map((v, i) => v + t * (d[i] ?? 0)));
    let fc = at(c);
    let fe = at(e);
    for (let k = 0; k < 80; k += 1) {
        if (fc < fe) {
            hi = e;
            e = c;
            fe = fc;
            c = hi - PHI * (hi - lo);
            fc = at(c);
        } else {
            lo = c;
            c = e;
            fc = fe;
            e = lo + PHI * (hi - lo);
            fe = at(e);
        }
    }
    const t = (lo + hi) / 2;
    return x.map((v, i) => v + t * (d[i] ?? 0));
}

function normalize(d: number[]): number[] {
    const n = Math.sqrt(d.reduce((sum, v) => sum + v * v, 0));
    return n < 1e-12 ? d : d.map((v) => v / n);
}

/** Run Powell's method, returning the full trace of iterates. */
export function powell(
    f: (p: number[]) => number,
    start: number[],
    iterations: number,
): { best: number[]; value: number; trace: number[][] } {
    let x = [...start];
    let directions: number[][] = [
        [1, 0],
        [0, 1],
    ];
    const trace: number[][] = [[...x]];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const previous = [...x];
        for (const d of directions) {
            x = lineSearch(f, x, d);
        }
        const displacement = x.map((v, i) => v - (previous[i] ?? 0));
        x = lineSearch(f, x, normalize(displacement));
        const replace = iteration % directions.length;
        if (displacement.some((v) => Math.abs(v) > 1e-12)) {
            directions[replace] = normalize(displacement);
        }
        trace.push([...x]);
    }
    return { best: x, value: f(x), trace };
}

function makePoints(trace: number[][], best: number[]): VisualEntity[] {
    const bestKey = best.join(",");
    return trace.map((point, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: `(${point[0]?.toFixed(2)}, ${point[1]?.toFixed(2)})`,
        value: [...point],
        state: (point.join(",") === bestKey ? "sorted" : "idle") as EntityState,
        x: point[0] ?? 0,
        y: point[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { index, x: point[0] ?? 0, y: point[1] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { func?: ObjectiveName; start?: number[]; iterations?: number } | null) ?? {};
    const name: ObjectiveName =
        task.func && ["quadratic", "sphere", "rosenbrock"].includes(task.func) ? task.func : "quadratic";
    const start = Array.isArray(task.start) && task.start.length >= 2 ? [...task.start] : [0, 0];
    const iterations = Math.min(40, Math.max(1, Math.floor(Number(task.iterations ?? 12)) || 12));
    const f = (p: number[]): number => objective(name, p[0] ?? 0, p[1] ?? 0);
    const result = powell(f, start, iterations);
    const values = result.trace.map((p) => f(p));

    yield {
        stepNumber: 0,
        entities: makePoints([result.trace[0] as number[]], result.trace[0] as number[]),
        edges: [],
        description: `Powell's method minimizing ${name} from (${start[0]}, ${start[1]}) with an initial direction set.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iterations, iteration: 0, best: [...(result.trace[0] as number[])], value: values[0] ?? 0, history: values },
    };

    for (let i = 1; i < result.trace.length; i += 1) {
        yield {
            stepNumber: i,
            entities: makePoints(result.trace.slice(0, i + 1), result.best),
            edges: [],
            description: `Sweep ${i}: moved to (${(result.trace[i]?.[0] ?? 0).toFixed(4)}, ${(result.trace[i]?.[1] ?? 0).toFixed(4)}) with objective ${(values[i] ?? 0).toFixed(6)}.`,
            codeLineNumber: i === result.trace.length - 1 ? 6 : 4,
            layout: "point",
            meta: { iterations, iteration: i, best: [...(result.trace[i] as number[])], value: values[i] ?? 0, history: values },
        };
    }

    yield {
        stepNumber: result.trace.length,
        entities: makePoints(result.trace, result.best),
        edges: [],
        description: `Converged to (${result.best[0]?.toFixed(5)}, ${result.best[1]?.toFixed(5)}) with objective ${result.value.toFixed(8)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { iterations, iteration: result.trace.length - 1, best: result.best, value: result.value, history: values },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Powell's method crawls downhill without derivatives by doing a one-dimensional minimization along each search direction in turn. After a full sweep, the net move is a promising new direction, so the method swaps it in for one of the old ones. On a quadratic bowl the new directions are conjugate, meaning each sweep makes progress independent of the others and the minimum is found in just a few sweeps.",
        invariants: [
            "The objective value never increases from one sweep to the next.",
            "Each new direction is the net displacement of a complete sweep.",
            "The direction set always spans the search space, so no descent direction is lost.",
        ],
        correctness:
            "For a positive-definite quadratic, exact minimization along a direction makes the gradient at the new point orthogonal to that direction. After sweeping all n directions the gradient is orthogonal to their span, hence zero, so the point is the minimizer. The net displacement of that sweep is conjugate to the directions already used, and replacing an old direction preserves a spanning set while adding a new independent descent direction. On general smooth functions the method is a descent method and converges to a local minimum.",
        complexityRationale:
            "Each sweep performs n plus one line searches, each using a fixed number of golden-section iterations and objective evaluations, so the work per sweep is O(n * lineSearchSteps). Only the point, the n directions, and the trace are stored, giving O(n) working space.",
        uses: [
            "Derivative-free tuning when gradients are unavailable or unreliable",
            "Calibrating simulation parameters with expensive objective evaluations",
            "Optimizing non-smooth objectives in scientific and engineering tools",
        ],
        references: [
            "Powell, An Efficient Method for Finding the Minimum of a Function, 1964",
            "Numerical Recipes, Chapter 10 (Minimization of Functions)",
        ],
        workedExample:
            "Minimizing (x-1)^2 + 2(y-2)^2 from (0,0), the first sweep searches along the x and y axes, moving to roughly (1,0) then (1,2). The net displacement points straight at the minimum; an extra line search along it lands at (1,2) with objective zero, and the next sweep makes no further progress.",
    },
    id: "powell-method",
    name: "Powell's Conjugate Direction Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n * lineSearchSteps)", space: "O(n)" },
    defaultInput: { func: "quadratic", start: [0, 0], iterations: 12 },
    visualType: "point",
    run,
    pseudocode: [
        "choose an initial point and axial search directions",
        "for each sweep up to the iteration budget",
        "minimize the objective along each direction in turn",
        "record the net displacement of the whole sweep",
        "minimize once more along the new displacement direction",
        "replace an old direction with the normalized displacement",
        "repeat until the sweep budget is spent",
        "done: report the best point and its objective value",
    ],
};

export default module;
