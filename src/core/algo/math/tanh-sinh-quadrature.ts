/**
 * tanh-sinh-quadrature.ts - Tanh-Sinh (Double Exponential) Quadrature.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tanh-sinh quadrature maps the integration interval to the real line with the
 * substitution x = tanh((pi/2) sinh t). The transformed integrand decays double
 * exponentially, so an equidistant trapezoid rule in t becomes extremely
 * accurate. Each frame refines the step size h and shows the new estimate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) per level with N nodes; O(N log N) across refinement levels
 *   Space: O(N) for the accumulated node table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row is a refinement level with step size, node count, estimate.
 *   - The newest row is highlighted and the final row is green.
 *   - The final frame reports the integral and its absolute error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TanhSinhInput {
    a?: number;
    b?: number;
    levels?: number;
}

interface Row {
    level: number;
    h: number;
    nodes: number;
    estimate: number;
}

/** Default test integrand: x squared, whose integral on [0,1] is 1/3. */
function defaultFunction(x: number): number {
    return x * x;
}

function estimateAt(a: number, b: number, h: number): { estimate: number; nodes: number } {
    const midpoint = (a + b) / 2;
    const half = (b - a) / 2;
    const n = Math.ceil(12 / h);
    let sum = 0;
    for (let k = -n; k <= n; k += 1) {
        const t = k * h;
        const u = (Math.PI / 2) * Math.sinh(t);
        const transformed = Math.tanh(u);
        const weight = (Math.PI / 2) * Math.cosh(t) / (Math.cosh(u) * Math.cosh(u));
        sum += defaultFunction(midpoint + half * transformed) * weight;
    }
    return { estimate: h * sum * half, nodes: 2 * n + 1 };
}

function fmt(value: number): string {
    return Number.isFinite(value) ? value.toPrecision(9) : String(value);
}

function makeEntities(rows: Row[], done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (const row of rows) {
        const values: Array<[string, number]> = [
            ["level", row.level],
            ["h", row.h],
            ["nodes", row.nodes],
            ["integral", row.estimate],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${row.level}-${col}`,
                type: "cell" as const,
                label: `${name}=${fmt(value)}`,
                value,
                state: (done ? "sorted" : row === rows[rows.length - 1] ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: row.level, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TanhSinhInput | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 0;
    const b = typeof task.b === "number" ? task.b : 1;
    const levels = typeof task.levels === "number" && task.levels > 0
        ? Math.trunc(task.levels)
        : 4;
    const rows: Row[] = [];

    for (let level = 0; level < levels; level += 1) {
        const h = Math.pow(0.5, level);
        const { estimate, nodes } = estimateAt(a, b, h);
        rows.push({ level, h, nodes, estimate });
        yield {
            stepNumber: level,
            entities: makeEntities(rows, false),
            edges: [],
            description: `Level ${level}: step h=${fmt(h)} over ${nodes} nodes gives integral about ${fmt(estimate)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: rows.length,
                cols: 4,
                level,
                h,
                nodes,
                estimate,
                error: Math.abs(estimate - 1 / 3),
            },
        };
    }

    const final = rows[rows.length - 1];
    yield {
        stepNumber: rows.length,
        entities: makeEntities(rows, true),
        edges: [],
        description: `Done after ${levels} level(s): the integral of x squared on [${a}, ${b}] is about ${fmt(final?.estimate ?? 0)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: rows.length,
            cols: 4,
            estimate: final?.estimate ?? 0,
            error: Math.abs((final?.estimate ?? 0) - 1 / 3),
        },
    };
}

const module: AlgorithmModule = {
    id: "tanh-sinh-quadrature",
    name: "Tanh-Sinh Quadrature",
    category: "math",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: { a: 0, b: 1, levels: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose an initial step size h and a node range",
        "for each refinement level",
        "map node t to x = tanh((pi/2) sinh t) with weight (pi/2)cosh(t)/cosh(u)^2",
        "sum f(x) times weight over all nodes and multiply by h",
        "halve h and repeat to refine the estimate",
        "done: report the integral and its error",
    ],
    education: {
        intuition:
            "Ordinary trapezoid rules waste points on a finite interval. Tanh-sinh quadrature first stretches the interval onto the whole real line with a double-exponential map, so the integrand and its weights fall off faster than any polynomial at the ends. A uniform trapezoid sum in the transformed variable then converges astonishingly fast, even for integrands with endpoint singularities.",
        invariants: [
            "The map x = tanh((pi/2) sinh t) sends the real line onto (-1,1).",
            "Each node carries the Jacobian weight (pi/2)cosh(t)/cosh(u)^2.",
            "The physical interval [a,b] is obtained by scaling and shifting (-1,1).",
            "Halving h exponentially increases accuracy because the transformed integrand decays double exponentially.",
        ],
        correctness:
            "The trapezoidal rule for functions analytic on a strip has exponentially small error, and the tanh-sinh transform makes the product f(x(t))x'(t) analytic and double-exponentially decaying even at endpoints. The Euler-Maclaurin analysis then gives an error that decreases faster than any power of h, so refining h converges to the true integral; the demo integrand x squared has exact integral 1/3 on [0,1].",
        complexityRationale:
            "At step size h the node count is about 12/h per side, so a level costs O(N) evaluations. Halving h across L levels gives node counts that form a geometric series, so the total work is O(N log N) for the finest level and O(N) storage for its table.",
        uses: [
            "High-precision numerical integration in arbitrary-precision libraries",
            "Integrals with endpoint singularities or steep boundary layers",
            "Computing special-function constants and smooth physical integrals",
        ],
        references: [
            "Takahasi and Mori, Double Exponential Formulas for Numerical Integration, 1974",
            "Bailey, Jaffe and Broadhurst, High-Precision Numerical Integration Using Tanh-Sinh Quadrature",
        ],
        workedExample:
            "Integrating x squared on [0,1]: at a coarse step the estimate is about 0.3333, and refining to h=1/8 brings it within a few units in the last place of the exact value 1/3, demonstrating the rapid double-exponential convergence.",
    },
};

export default module;
