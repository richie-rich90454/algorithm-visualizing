/**
 * nelder-mead.ts - Nelder-Mead Simplex Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nelder-Mead is a derivative-free method for minimizing a scalar function of
 * several variables. It maintains a simplex of n+1 points in n dimensions and
 * repeatedly replaces its worst vertex with a better one. A reflection sends
 * the worst point through the centroid of the rest; if that succeeds the
 * simplex expands, otherwise it contracts toward the centroid, and as a last
 * resort it shrinks every vertex toward the best one. No gradients are needed,
 * which makes the method popular for noisy or non-smooth objectives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) function evaluations per iteration (n+1 vertices)
 *   Space: O(n^2) for the simplex and its sorted copy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each simplex vertex is a point; the best vertex is green, worst red.
 *   - A point turns yellow when it is the current proposal (reflection,
 *     expansion, contraction, or shrink).
 *   - meta carries the simplex, the best point, and the best objective value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export type ObjectiveName = "quadratic" | "sphere" | "rosenbrock";

/** Evaluate one of the built-in teaching objectives. */
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
            return (x - 1) * (x - 1) + (y + 2) * (y + 2);
    }
}

export interface IterationRecord {
    iteration: number;
    action: string;
    best: number[];
    value: number;
    simplex: number[][];
}

export interface NelderMeadResult {
    best: number[];
    value: number;
    history: IterationRecord[];
}

interface Vertex {
    point: number[];
    value: number;
}

const ALPHA = 1;
const GAMMA = 2;
const RHO = 0.5;
const SIGMA = 0.5;

/** Run Nelder-Mead on a two-dimensional objective. */
export function nelderMead(
    f: (point: number[]) => number,
    initial: number[][],
    iterations: number,
): NelderMeadResult {
    let simplex: Vertex[] = initial.map((point) => ({ point: [...point], value: f(point) }));
    const history: IterationRecord[] = [];
    const sort = (): void => {
        simplex.sort((a, b) => a.value - b.value);
    };
    sort();

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        sort();
        const best = simplex[0] as Vertex;
        const secondWorst = simplex[simplex.length - 2] as Vertex;
        const worst = simplex[simplex.length - 1] as Vertex;
        const n = worst.point.length;
        const centroid = Array.from({ length: n }, (_, d) =>
            simplex.slice(0, simplex.length - 1).reduce((sum, vertex) => sum + (vertex.point[d] as number), 0) / (simplex.length - 1),
        );

        const reflect = centroid.map((c, d) => c + ALPHA * (c - (worst.point[d] as number)));
        const reflectValue = f(reflect);
        let action = "reflect";

        if (reflectValue < (best.value as number)) {
            const expand = centroid.map((c, d) => c + GAMMA * ((reflect[d] as number) - c));
            const expandValue = f(expand);
            if (expandValue < reflectValue) {
                simplex[simplex.length - 1] = { point: expand, value: expandValue };
                action = "expand";
            } else {
                simplex[simplex.length - 1] = { point: reflect, value: reflectValue };
            }
        } else if (reflectValue < (secondWorst.value as number)) {
            simplex[simplex.length - 1] = { point: reflect, value: reflectValue };
        } else {
            const useOutside = reflectValue < (worst.value as number);
            const base = useOutside ? reflect : worst.point;
            const contract = centroid.map((c, d) => c + RHO * ((base[d] as number) - c));
            const contractValue = f(contract);
            if (contractValue < Math.min(reflectValue, worst.value)) {
                simplex[simplex.length - 1] = { point: contract, value: contractValue };
                action = "contract";
            } else {
                simplex = simplex.map((vertex, index) =>
                    index === 0
                        ? vertex
                        : {
                            point: vertex.point.map((coordinate, d) => (best.point[d] as number) + SIGMA * (coordinate - (best.point[d] as number))),
                            value: 0,
                        },
                );
                for (const vertex of simplex) {
                    vertex.value = f(vertex.point);
                }
                action = "shrink";
            }
        }
        sort();
        history.push({
            iteration,
            action,
            best: [...(simplex[0] as Vertex).point],
            value: (simplex[0] as Vertex).value,
            simplex: simplex.map((vertex) => [...vertex.point]),
        });
    }
    sort();
    return { best: [...(simplex[0] as Vertex).point], value: (simplex[0] as Vertex).value, history };
}

/** Build point entities from a simplex, marking the proposal and extremes. */
function makePoints(simplex: number[][], f: (point: number[]) => number, best: number[], proposal: number[] | null): VisualEntity[] {
    const bestKey = best.join(",");
    const worst = [...simplex].sort((a, b) => f(b) - f(a))[0] ?? [];
    const worstKey = worst.join(",");
    return simplex.map((point, index) => {
        const key = point.join(",");
        let state: EntityState = "idle";
        if (proposal && key === proposal.join(",")) {
            state = "comparing";
        } else if (key === bestKey) {
            state = "sorted";
        } else if (key === worstKey) {
            state = "error";
        }
        return {
            id: `vertex-${index}`,
            type: "node" as const,
            label: `(${point[0]?.toFixed(2)}, ${point[1]?.toFixed(2)})`,
            value: [...point],
            state,
            x: point[0] ?? 0,
            y: point[1] ?? 0,
            width: 0,
            height: 0,
            metadata: { index, x: point[0] ?? 0, y: point[1] ?? 0 },
        };
    });
}

/** The Nelder-Mead generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { func?: ObjectiveName; start?: number[]; step?: number; iterations?: number } | null) ?? {};
    const name: ObjectiveName = task.func && ["quadratic", "sphere", "rosenbrock"].includes(task.func) ? task.func : "quadratic";
    const start = Array.isArray(task.start) && task.start.length >= 2 ? [...task.start] : [0, 0];
    const step = typeof task.step === "number" ? task.step : 1;
    const iterations = Math.min(120, Math.max(1, Math.floor(Number(task.iterations ?? 60)) || 60));
    const f = (point: number[]): number => objective(name, point[0] ?? 0, point[1] ?? 0);
    const initial = [
        [...start],
        [start[0] + step, start[1]],
        [start[0], start[1] + step],
    ];
    const result = nelderMead(f, initial, iterations);

    let frame = 0;
    yield {
        stepNumber: frame++,
        entities: makePoints(initial, f, initial[0] as number[], null),
        edges: [],
        description: `Minimizing ${name} with a simplex of 3 points starting at (${start[0]}, ${start[1]}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iterations, iteration: 0, best: [...start], value: f(start), action: "init" },
    };

    for (const record of result.history) {
        const proposal = record.simplex.find((point) => point.join(",") !== record.best.join(",")) ?? null;
        yield {
            stepNumber: frame++,
            entities: makePoints(record.simplex, f, record.best, proposal),
            edges: [],
            description: `Iteration ${record.iteration}: ${record.action} step; best point (${record.best[0]?.toFixed(4)}, ${record.best[1]?.toFixed(4)}) with value ${record.value.toFixed(6)}.`,
            codeLineNumber: record.action === "reflect" ? 3 : record.action === "expand" ? 4 : record.action === "contract" ? 5 : 6,
            layout: "point",
            meta: { iterations, iteration: record.iteration, best: [...record.best], value: record.value, action: record.action },
        };
    }

    yield {
        stepNumber: frame,
        entities: makePoints(result.history[result.history.length - 1]?.simplex ?? initial, f, result.best, null),
        edges: [],
        description: `Converged to (${result.best[0]?.toFixed(5)}, ${result.best[1]?.toFixed(5)}) with objective value ${result.value.toFixed(8)}.`,
        codeLineNumber: 8,
        layout: "point",
        meta: { iterations, iteration: result.history.length, best: result.best, value: result.value, action: "done", func: name },
    };
}

/** The Nelder-Mead module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Float a triangle of candidate points in the search space and let it crawl downhill. Each step looks at the worst corner, reflects it through the middle of the others, and accepts the move if it improves things. When the reflection is excellent the simplex stretches; when it is poor the simplex contracts or shrinks. Over many small steps the triangle squeezes around a local minimum without ever needing a derivative.",
        invariants: [
            "The simplex always holds n+1 distinct points in n dimensions.",
            "The ordered simplex never has a worse best value than the previous iteration.",
            "Every replacement point is built only from existing vertices and the centroid.",
        ],
        correctness:
            "A reflection, expansion, or accepted contraction replaces the worst vertex with a point of strictly lower objective value, so the best-so-far value is non-increasing and bounded below for a function with a minimum. If no such improvement exists, shrinking pulls all vertices toward the current best, reducing the simplex diameter by the shrink factor. Repeated shrinking drives the diameter toward zero, so the simplex collapses around a local minimizer. Like all local methods, convergence is to a local optimum, not necessarily the global one for multimodal functions.",
        complexityRationale:
            "Each iteration evaluates the reflection plus at most one expansion or contraction, or n+1 evaluations on a shrink; sorting n+1 vertices is constant for fixed n, so the work is O(iterations * n). The simplex and its sorted copy use O(n^2) space.",
        uses: [
            "Derivative-free parameter fitting in engineering and statistics",
            "Tuning hyperparameters when the objective is noisy or expensive",
            "Minimizing non-smooth objectives in scientific software such as SciPy",
        ],
        references: [
            "Nelder and Mead, A Simplex Method for Function Minimization, 1965",
            "Lagarias et al., Convergence Properties of the Nelder-Mead Simplex Method, 1998",
        ],
        workedExample:
            "Minimizing (x-1)^2 + (y+2)^2 from a simplex at (0,0), (1,0), (0,1), reflection and expansion push the worst corner across the centroid toward the minimum at (1, -2). After a few dozen iterations the simplex contracts tightly around (1, -2) with an objective value near zero.",
    },
    id: "nelder-mead",
    name: "Nelder-Mead Simplex Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n)", space: "O(n^2)" },
    defaultInput: { func: "quadratic", start: [0, 0], step: 1, iterations: 60 },
    visualType: "point",
    run,
    pseudocode: [
        "build an initial simplex of n plus one points",
        "sort vertices by objective value, best first",
        "compute the centroid of all but the worst vertex",
        "reflect the worst point through the centroid",
        "expand when the reflection beats the best vertex",
        "contract when the reflection only helps a little",
        "shrink every vertex toward the best as a last resort",
        "repeat until the iteration budget is spent",
        "done: report the best point and its value",
    ],
};

export default module;
