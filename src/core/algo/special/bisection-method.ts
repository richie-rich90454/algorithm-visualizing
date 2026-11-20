/**
 * bisection-method.ts – Bisection Method.
 * Roots x^3-x-2=0 on [1,2] (sign change): each step halves the
 * interval, keeping the half whose endpoints still straddle zero.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const f = (x: number): number => x * x * x - x - 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { a?: number; b?: number; iters?: number } | null) ?? {};
    let a = Number.isFinite(cfg.a) ? (cfg.a as number) : 1;
    let b = Number.isFinite(cfg.b) ? (cfg.b as number) : 2;
    if (a >= b) {
        const t = a;
        a = b;
        b = t;
        if (a === b) b = a + 1;
    }
    if (f(a) * f(b) > 0) {
        a = 1;
        b = 2;
    }
    const iters = Math.max(1, Math.min(10, cfg.iters ?? 8));
    let step = 0;
    let mid = (a + b) / 2;
    const frame = (desc: string, line: number): VisualFrame => {
        const vals = [a, mid, b];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `pt-${i}`,
            type: "bar" as const,
            label: v.toFixed(4),
            value: Math.round(v * 10000) / 10000,
            state: (i === 1 ? "comparing" : "idle") as EntityState,
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
                a: Math.round(a * 10000) / 10000,
                mid: Math.round(mid * 10000) / 10000,
                b: Math.round(b * 10000) / 10000,
                width: Math.round((b - a) * 10000) / 10000,
            },
        };
    };
    yield frame(
        `Interval [${a},${b}]: f(a)=${f(a).toFixed(2)}, f(b)=${f(b).toFixed(2)} straddle zero.`,
        0,
    );
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        mid = (a + b) / 2;
        const side = f(a) * f(mid) <= 0 ? "left" : "right";
        if (side === "left") b = mid;
        else a = mid;
        yield frame(
            `Step ${t}: mid=${mid.toFixed(4)} (f=${f(mid).toFixed(4)}), keeping ${side} half [${a.toFixed(4)},${b.toFixed(4)}].`,
            t,
        );
        step += 1;
    }
    yield frame(`Root ≈ ${mid.toFixed(4)} (true root ≈ 1.5214).`, iters + 1);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Bisection finds a root of a continuous function by repeatedly halving an interval whose endpoints have opposite signs. If f(a) and f(b) bracket zero, evaluate the midpoint and keep whichever half still straddles zero. Each step shrinks the interval while guaranteeing the root remains inside it.",
        "invariants": [
            "f(a) and f(b) always have opposite signs, or one endpoint is a root.",
            "The interval [a,b] only shrinks, halving in width each iteration.",
            "The true root always lies within the current interval."
        ],
        "correctness": "The intermediate value theorem says a continuous function taking opposite signs at a and b must cross zero between them. Keeping the sub-interval whose endpoints still straddle zero preserves that guarantee, so after t steps the midpoint is within (b-a)/2^(t+1) of a root. Convergence is assured for any continuous function with a bracketed root.",
        "complexityRationale": "Each iteration does constant work: one function evaluation and a sign test, so t iterations cost O(t). Only the endpoints and midpoint are stored, O(1) space. Halving the interval each step gives linear convergence in the number of iterations.",
        "uses": [
            "Solving equations in engineering and physics",
            "Root-finding routines in numerical libraries",
            "Computing implied interest rates and internal rate of return",
            "Calibrating model parameters and embedded-systems math"
        ],
        "references": [
            "Burden and Faires, Numerical Analysis, Chapter 2",
            "Press et al., Numerical Recipes, Chapter 9"
        ],
        "workedExample": "For f(x)=x^3-x-2 on [1,2], f(1)=-2 and f(2)=4 straddle zero. The midpoint 1.5 has f(1.5)=-0.125, so keep the right half [1.5,2]. The next midpoint 1.75 has f>0, so keep [1.5,1.75]. Continuing halves the bracket until the root is approximately 1.5214."
    },
    id: "bisection-method",
    name: "Bisection Method",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { a: 1, b: 2, iters: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize interval [a, b] where f(a) and f(b) straddle zero",
        "for iteration t <- 1 to iters",
        "compute midpoint mid <- (a + b) / 2",
        "keep the half whose endpoints still straddle zero",
        "shrink the interval width by half each step",
        "repeat until the interval is tiny",
        "done: mid approximates the true root 1.5214",
    ],
};

export default module;
