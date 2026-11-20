/**
 * nelder-mead-simplex.ts – Nelder–Mead Simplex.
 * Minimizes (x-2)^2+(y-1)^2 from {(0,0),(1,0),(0,1)}: order the
 * triangle, then reflect / expand / contract / shrink the worst
 * vertex around the centroid of the rest.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
const f = (p: Pt): number => (p[0] - 2) * (p[0] - 2) + (p[1] - 1) * (p[1] - 1);
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { iters?: number } | null) ?? {};
    const iters = Math.max(1, Math.min(8, cfg.iters ?? 5));
    let s: Pt[] = [
        [0, 0],
        [1, 0],
        [0, 1],
    ];
    let step = 0;
    let op = "initial";
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = s.map((p, i) => ({
            id: `v-${i}`,
            type: "cell" as const,
            label: `(${p[0].toFixed(2)},${p[1].toFixed(2)})=${f(p).toFixed(2)}`,
            value: Math.round(f(p) * 100) / 100,
            state: (i === 0 ? "sorted" : i === 2 ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "grid",
            meta: { op, best: Math.round(f(s[0] as Pt) * 10000) / 10000 },
        };
    };
    yield frame("Initial simplex: best vertex is green, worst is yellow.", 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        s = [...s].sort((p, q) => f(p) - f(q));
        const [best, second, worst] = s as [Pt, Pt, Pt];
        const c = mid(best, second);
        const xr = add(c, sub(c, worst));
        if (f(xr) < f(best)) {
            const xe = add(c, sub(xr, worst));
            s = [f(xe) < f(xr) ? xe : xr, best, second];
            op = "expand";
        } else if (f(xr) < f(second)) {
            s = [best, second, xr];
            op = "reflect";
        } else {
            const xc = f(xr) < f(worst) ? mid(c, xr) : mid(c, worst);
            if (f(xc) < f(worst)) {
                s = [best, second, xc];
                op = "contract";
            } else {
                s = [best, mid(best, second), mid(best, worst)];
                op = "shrink";
            }
        }
        s = [...s].sort((p, q) => f(p) - f(q));
        yield frame(
            `Iteration ${t}: ${op} → best (${s[0]?.[0].toFixed(2)},${s[0]?.[1].toFixed(2)}) f=${f(s[0] as Pt).toFixed(4)}.`,
            t,
        );
        step += 1;
    }
    const b = s[0] as Pt;
    yield frame(
        `Done: best (${b[0].toFixed(3)},${b[1].toFixed(3)}) f=${f(b).toFixed(5)} (optimum (2,1)).`,
        iters + 1,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Nelder-Mead is a derivative-free optimizer for low-dimensional functions. It maintains a simplex, a triangle in two dimensions, of candidate points, sorts them by function value, and repeatedly replaces the worst point by reflecting, expanding, contracting or shrinking it around the centroid of the better points. The simplex crawls downhill toward a minimum.",
        "invariants": [
            "The simplex always has n+1 vertices in n dimensions.",
            "The best vertex's function value never increases across iterations.",
            "The operations keep the vertices distinct in normal operation."
        ],
        "correctness": "Nelder-Mead is a heuristic without a general convergence guarantee to a global optimum. Each operation is designed so improved points replace worse ones, and for well-behaved unimodal functions the simplex typically contracts toward a local minimum. The demo reports the best vertex value, which is non-increasing.",
        "complexityRationale": "Each iteration sorts a constant number of vertices, three in two dimensions, and does a few function evaluations, O(n) for n dimensions, so t iterations cost O(t·n). Storing the simplex uses O(n) space.",
        "uses": [
            "Parameter fitting when derivatives are unavailable or unreliable",
            "Engineering design and scientific model calibration",
            "Curve fitting and low-dimensional hyperparameter tuning",
            "Numerical optimization in spreadsheet solvers"
        ],
        "references": [
            "Nelder and Mead, A Simplex Method for Function Minimization, The Computer Journal, 1965",
            "Press et al., Numerical Recipes, Chapter 10"
        ],
        "workedExample": "Minimize f(x,y)=(x-2)^2+(y-1)^2 from triangle {(0,0),(1,0),(0,1)}. The worst vertex (0,0) has f=5 and the centroid of the other two is (0.5,0.5). Reflecting gives (1,1) with f=1; expanding goes toward (1.5,1.5). Repeated steps converge to (2,1), f=0."
    },
    id: "nelder-mead-simplex",
    name: "Nelder–Mead Simplex",
    category: "math",
    complexity: { time: "O(t·n)", space: "O(n)" },
    defaultInput: { iters: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize triangle simplex with three vertices",
        "order vertices best to worst by objective",
        "reflect worst vertex through centroid of rest",
        "expand further if reflection beats best",
        "contract or shrink when reflection still worst",
        "track best vertex value each iteration",
        "done: best point near optimum (2,1) reported",
    ],
};

export default module;
