/**
 * golden-section-search.ts – Golden-Section Search.
 * Minimizes (x-2)^2 on [0,5]: each step places interior points at the
 * golden ratio, discards the outer third, and reuses one evaluation.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const PHI = (1 + Math.sqrt(5)) / 2;
const f = (x: number): number => (x - 2) * (x - 2);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { a?: number; b?: number; iters?: number } | null) ?? {};
    let a = Number.isFinite(cfg.a) ? (cfg.a as number) : 0;
    let b = Number.isFinite(cfg.b) ? (cfg.b as number) : 5;
    if (a >= b) {
        const t = a;
        a = b;
        b = t;
        if (a === b) b = a + 1;
    }
    const iters = Math.max(1, Math.min(10, cfg.iters ?? 7));
    let c = b - (b - a) / PHI;
    let d = a + (b - a) / PHI;
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const vals = [a, c, d, b];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `pt-${i}`,
            type: "bar" as const,
            label: v.toFixed(3),
            value: Math.round(v * 1000) / 1000,
            state: (i === 1 || i === 2 ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "array",
            meta: {
                a: Math.round(a * 1000) / 1000,
                b: Math.round(b * 1000) / 1000,
                width: Math.round((b - a) * 1000) / 1000,
            },
        };
    };
    yield frame(
        `Bracket [${a},${b}] with interior points c=${c.toFixed(3)}, d=${d.toFixed(3)}.`,
        0,
    );
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        if (f(c) < f(d)) {
            b = d;
            d = c;
            c = b - (b - a) / PHI;
        } else {
            a = c;
            c = d;
            d = a + (b - a) / PHI;
        }
        yield frame(
            `Step ${t}: f(c)=${f(c).toFixed(4)} vs f(d)=${f(d).toFixed(4)} → [${a.toFixed(3)},${b.toFixed(3)}].`,
            t,
        );
        step += 1;
    }
    const best = (a + b) / 2;
    yield frame(`Minimum ≈ ${best.toFixed(4)} (true minimum x=2).`, iters + 1);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Golden-section search finds the minimum of a unimodal function on an interval without using derivatives. It places two interior points so the interval keeps the same golden-ratio proportions after a cut, allowing one interior point to be reused at every step. Comparing the function values at the two points discards the worse outer third.",
        "invariants": [
            "The minimizer always remains inside the current bracket [a,b].",
            "The two interior points sit at golden-ratio positions, so one survives each shrink.",
            "The bracket width shrinks by a constant factor of 1/PHI each iteration."
        ],
        "correctness": "For a unimodal function, if f(c) < f(d) with c < d, the minimum cannot lie to the right of d, so discarding [d,b] preserves it; the symmetric argument applies otherwise. Because the points are placed by the golden ratio, the remaining interval reuses one evaluation. Repeated cuts therefore converge to the minimizer.",
        "complexityRationale": "Each iteration does one or two function evaluations, thanks to reuse, and constant arithmetic, so t iterations cost O(t). Only the endpoints and interior points are stored, O(1) space. The bracket shrinks geometrically, giving linear convergence in t.",
        "uses": [
            "Line search inside larger optimization algorithms",
            "Hyperparameter tuning when derivatives are unavailable",
            "Engineering design and model calibration",
            "Minimizing response surfaces and loss functions"
        ],
        "references": [
            "Brent, Algorithms for Minimization Without Derivatives, Chapter 3",
            "Press et al., Numerical Recipes, Chapter 10"
        ],
        "workedExample": "Minimize f(x)=(x-2)^2 on [0,5]. The interior points are c=5-5/PHI≈1.91 and d=5/PHI≈3.09. Since f(c)≈0.008 is less than f(d)≈1.19, discard [d,5] and keep [0,3.09], reusing c as the new d. Repeating narrows the bracket toward x=2."
    },
    id: "golden-section-search",
    name: "Golden-Section Search",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { a: 0, b: 5, iters: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize bracket [a,b] with interior points c and d",
        "place c and d by the golden ratio PHI",
        "for iteration t <- 1 to iters",
        "compare f(c) versus f(d) to pick a side",
        "discard the outer third and reuse one evaluation",
        "shrink the bracket width geometrically",
        "done: midpoint approximates true minimum x=2",
    ],
};

export default module;
