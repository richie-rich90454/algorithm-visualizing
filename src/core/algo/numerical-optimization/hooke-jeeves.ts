/**
 * hooke-jeeves.ts - Hooke-Jeeves Pattern Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hooke-Jeeves is a derivative-free optimizer built from an exploratory move
 * and a pattern move. The exploratory move probes each coordinate in both
 * directions by one step and keeps any improvement. If that succeeds, a
 * pattern move extrapolates along the direction of recent progress and is
 * itself probed. When no probe helps, the step length is halved. This walk of
 * probes and jumps needs no derivatives and works on non-smooth objectives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) objective evaluations
 *   Space: O(n) for the work points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points trace the base point after each iteration in the search plane.
 *   - The best point is green; the step length is shown in the caption.
 *   - meta carries the best point, value, step length, and value history.
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

/** Probe each coordinate by plus and minus the step, accepting improvements. */
function explore(f: (p: number[]) => number, point: number[], step: number): number[] {
    let current = [...point];
    for (let d = 0; d < current.length; d += 1) {
        for (const sign of [1, -1]) {
            const candidate = [...current];
            candidate[d] = (candidate[d] ?? 0) + sign * step;
            if ((f(candidate) ?? Infinity) < f(current)) {
                current = candidate;
                break;
            }
        }
    }
    return current;
}

export interface HookeJeevesResult {
    best: number[];
    value: number;
    step: number;
    trace: number[][];
    steps: number[];
}

/** Run the Hooke-Jeeves pattern search. */
export function hookeJeeves(
    f: (p: number[]) => number,
    start: number[],
    initialStep: number,
    iterations: number,
    tolerance: number,
): HookeJeevesResult {
    let base = [...start];
    let step = initialStep;
    const trace: number[][] = [[...base]];
    const steps: number[] = [step];
    for (let iteration = 0; iteration < iterations && step >= tolerance; iteration += 1) {
        const trial = explore(f, base, step);
        if (f(trial) < f(base)) {
            const pattern = base.map((v, i) => 2 * (trial[i] ?? 0) - v);
            const candidate = explore(f, pattern, step);
            base = f(candidate) < f(trial) ? candidate : trial;
        } else {
            step /= 2;
        }
        trace.push([...base]);
        steps.push(step);
    }
    return { best: base, value: f(base), step, trace, steps };
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
    const task = (
        input as { func?: ObjectiveName; start?: number[]; step?: number; iterations?: number; tolerance?: number } | null
    ) ?? {};
    const name: ObjectiveName =
        task.func && ["quadratic", "sphere", "rosenbrock"].includes(task.func) ? task.func : "quadratic";
    const start = Array.isArray(task.start) && task.start.length >= 2 ? [...task.start] : [0, 0];
    const initialStep = typeof task.step === "number" && task.step > 0 ? task.step : 1;
    const iterations = Math.min(200, Math.max(1, Math.floor(Number(task.iterations ?? 80)) || 80));
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-4;
    const f = (p: number[]): number => objective(name, p[0] ?? 0, p[1] ?? 0);
    const result = hookeJeeves(f, start, initialStep, iterations, tolerance);
    const values = result.trace.map((p) => f(p));

    yield {
        stepNumber: 0,
        entities: makePoints([result.trace[0] as number[]], result.trace[0] as number[]),
        edges: [],
        description: `Hooke-Jeeves minimizing ${name} from (${start[0]}, ${start[1]}) with initial step ${initialStep}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iterations, iteration: 0, best: [...(result.trace[0] as number[])], value: values[0] ?? 0, step: result.steps[0] ?? initialStep, history: values },
    };

    for (let i = 1; i < result.trace.length; i += 1) {
        yield {
            stepNumber: i,
            entities: makePoints(result.trace.slice(0, i + 1), result.best),
            edges: [],
            description: `Iteration ${i}: base point (${(result.trace[i]?.[0] ?? 0).toFixed(4)}, ${(result.trace[i]?.[1] ?? 0).toFixed(4)}), objective ${(values[i] ?? 0).toFixed(6)}, step ${(result.steps[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: result.steps[i] !== result.steps[i - 1] ? 6 : 4,
            layout: "point",
            meta: { iterations, iteration: i, best: [...(result.trace[i] as number[])], value: values[i] ?? 0, step: result.steps[i] ?? 0, history: values },
        };
    }

    yield {
        stepNumber: result.trace.length,
        entities: makePoints(result.trace, result.best),
        edges: [],
        description: `Converged to (${result.best[0]?.toFixed(5)}, ${result.best[1]?.toFixed(5)}) with objective ${result.value.toFixed(8)} and step ${result.step.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { iterations, iteration: result.trace.length - 1, best: result.best, value: result.value, step: result.step, history: values },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hooke-Jeeves searches like a hiker feeling the ground with one foot at a time. It probes a small distance left, right, forward, and back from the current spot; if any probe is downhill it moves there and then tries a longer jump in the same general direction. When every probe is uphill it shortens its stride. Repeated probing and jumping homes in on a minimum without knowing the slope.",
        invariants: [
            "The base point never moves to a location with a worse objective value.",
            "The step length is positive and only decreases, halving after an unproductive iteration.",
            "A pattern move is always followed by an exploratory probe before it is accepted.",
        ],
        correctness:
            "An exploratory move only accepts a strict improvement, so the best-so-far value is non-increasing. A pattern move extrapolates along the direction of a successful step, which for a smooth objective points toward the minimum; it is accepted only if a subsequent exploratory probe confirms a lower value. When no probe improves the point, halving the step shrinks the search neighborhood. Because the step tends to zero and the objective is continuous, the iterates approach a local minimizer.",
        complexityRationale:
            "Each iteration probes at most two directions per coordinate for the exploratory move and again for the pattern probe, so it uses O(n) objective evaluations. Storing the base point, probe candidates, and trace takes O(n) working space.",
        uses: [
            "Derivative-free engineering design and parameter fitting",
            "Optimizing objectives with noise or discontinuities",
            "A simple baseline for pattern-search and direct-search methods",
        ],
        references: [
            "Hooke and Jeeves, Direct Search Solution of Numerical and Statistical Problems, 1961",
            "Baudet, A Survey of Direct Search Methods, 1978",
        ],
        workedExample:
            "Minimizing (x-1)^2 + 2(y-2)^2 from (0,0) with step one, the probes move to (1,0) and then (1,1). The pattern extrapolation jumps toward (1,2), where probes confirm a lower value. When the step eventually shrinks below tolerance near (1,2) the search stops with objective essentially zero.",
    },
    id: "hooke-jeeves",
    name: "Hooke-Jeeves Pattern Search",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: { func: "quadratic", start: [0, 0], step: 1, iterations: 80, tolerance: 1e-4 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a starting point, an initial step, and a tolerance",
        "probe each coordinate by plus and minus the step from the base point",
        "accept any probe that lowers the objective",
        "if the probe improved the point, extrapolate a pattern move",
        "probe around the pattern point and accept it if it is better",
        "otherwise halve the step length",
        "repeat until the step falls below the tolerance",
        "done: report the best point and its objective value",
    ],
};

export default module;
