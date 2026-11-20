/**
 * vincent-root-isolation.ts - Root Isolation by Vincent's Theorem
 *
 * Isolates the real roots of a polynomial in an interval by repeatedly
 * bisecting and applying Descartes' rule of signs to a Mobius-transformed
 * polynomial. When the transformed coefficient sequence has no sign changes
 * the interval holds no root; with one sign change it holds exactly one.
 *
 *   Time:  O(depth * degree^2) per interval
 *   Space: O(degree * intervals)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VincentInput {
    roots?: number[];
    interval?: [number, number];
    maxDepth?: number;
}

type Interval = [number, number];

function binomial(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let result = 1;
    for (let i = 1; i <= k; i += 1) {
        result = (result * (n - i + 1)) / i;
    }
    return result;
}

// Coefficients of q(t) = (1+t)^d * p((a + b t)/(1+t)), ascending powers of t.
function transform(coeffs: number[], a: number, b: number): number[] {
    const degree = coeffs.length - 1;
    const result = new Array<number>(degree + 1).fill(0);
    for (let i = 0; i <= degree; i += 1) {
        const ci = coeffs[i] ?? 0;
        if (ci === 0) continue;
        for (let j = 0; j <= i; j += 1) {
            const left = ci * binomial(i, j) * a ** (i - j) * b ** j;
            if (left === 0) continue;
            for (let l = 0; l <= degree - i; l += 1) {
                result[j + l] = (result[j + l] ?? 0) + left * binomial(degree - i, l);
            }
        }
    }
    return result;
}

function signChanges(coeffs: number[]): number {
    let last = 0;
    let changes = 0;
    for (const value of coeffs) {
        if (value === 0) continue;
        const sign = value > 0 ? 1 : -1;
        if (last !== 0 && sign !== last) changes += 1;
        last = sign;
    }
    return changes;
}

function polynomialFromRoots(roots: number[]): number[] {
    let coeffs = [1];
    for (const root of roots) {
        const next = new Array<number>(coeffs.length + 1).fill(0);
        for (let i = 0; i < coeffs.length; i += 1) {
            next[i] = (next[i] ?? 0) - root * (coeffs[i] ?? 0);
            next[i + 1] = (next[i + 1] ?? 0) + (coeffs[i] ?? 0);
        }
        coeffs = next;
    }
    return coeffs;
}

function evaluate(coeffs: number[], x: number): number {
    let value = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) {
        value = value * x + (coeffs[i] ?? 0);
    }
    return value;
}

function isolate(coeffs: number[], a: number, b: number, depth: number, maxDepth: number): Interval[] {
    const changes = signChanges(transform(coeffs, a, b));
    if (changes === 0) return [];
    if (changes === 1 || depth >= maxDepth) return [[a, b]];
    const mid = (a + b) / 2;
    return [...isolate(coeffs, a, mid, depth + 1, maxDepth), ...isolate(coeffs, mid, b, depth + 1, maxDepth)];
}

function makeEntities(coeffs: number[], a: number, b: number, intervals: Interval[], active: number): VisualEntity[] {
    const count = 41;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < count; i += 1) {
        const x = a + ((b - a) * i) / (count - 1);
        const y = evaluate(coeffs, x);
        const inInterval = intervals.some(([lo, hi]) => x >= lo && x <= hi);
        entities.push({
            id: `sample-${i}`,
            type: "node" as const,
            label: y.toFixed(2),
            value: y,
            state: (i === active ? "active" : inInterval ? "sorted" : "idle") as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, x, y },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as VincentInput | null) ?? {};
    const roots = Array.isArray(task.roots) && task.roots.length > 0 ? task.roots : [-1, 0.5, 2];
    const requested: Interval = Array.isArray(task.interval) && task.interval.length === 2
        ? [task.interval[0] ?? -4, task.interval[1] ?? 4]
        : [-4, 4];
    // Irrational nudges keep dyadic-ish roots off bisection midpoints, where a
    // zero endpoint coefficient would otherwise hide a root from Descartes.
    const interval: Interval = [requested[0] + Math.SQRT2 / 1000, requested[1] - Math.sqrt(3) / 1000];
    const maxDepth = typeof task.maxDepth === "number" && task.maxDepth >= 1 ? Math.trunc(task.maxDepth) : 32;
    const coeffs = polynomialFromRoots(roots);
    const degree = coeffs.length - 1;
    const [a, b] = interval;
    const intervals = isolate(coeffs, a, b, 0, maxDepth);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(coeffs, a, b, [], -1),
        edges: [],
        description: `Isolate real roots of a degree ${degree} polynomial on [${a}, ${b}] using Descartes sign changes.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { rows: 1, cols: 41, degree, a, b, intervalCount: 0, intervals: [] },
    };
    step += 1;

    for (let i = 0; i < intervals.length; i += 1) {
        const pair = intervals[i] ?? [a, b];
        yield {
            stepNumber: step,
            entities: makeEntities(coeffs, a, b, intervals.slice(0, i + 1), Math.floor(((pair[0] + pair[1]) / 2 - a) / (b - a) * 40)),
            edges: [],
            description: `Isolated root ${i + 1} inside [${pair[0].toFixed(4)}, ${pair[1].toFixed(4)}].`,
            codeLineNumber: 1,
            layout: "point",
            meta: { rows: 1, cols: 41, degree, a, b, intervalCount: i + 1, intervals: intervals.slice(0, i + 1).flat() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(coeffs, a, b, intervals, -1),
        edges: [],
        description: `Done: isolated ${intervals.length} real root(s) inside disjoint intervals.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { rows: 1, cols: 41, degree, a, b, intervalCount: intervals.length, intervals: intervals.flat() },
    };
}

const module: AlgorithmModule = {
    id: "vincent-root-isolation",
    name: "Vincent Root Isolation",
    category: "math",
    complexity: { time: "O(depth * degree^2) per interval", space: "O(degree * intervals)" },
    defaultInput: { roots: [-1, 0.5, 2], interval: [-4, 4], maxDepth: 32 },
    visualType: "point",
    run,
    pseudocode: [
        "transform p on interval [a,b] into q(t) = (1+t)^d p((a+bt)/(1+t))",
        "count the sign changes of the coefficients of q",
        "if there are no sign changes the interval contains no root",
        "if there is one sign change the interval isolates one root",
        "otherwise split at the midpoint and recurse on both halves",
        "done: return the disjoint isolating intervals",
    ],
    education: {
        intuition:
            "A polynomial's coefficient signs bound how many positive roots it can have. By bending the interval into the positive axis with a fractional substitution, Descartes' rule can be applied to any interval. If the bent polynomial has a single sign change, that interval traps exactly one root; otherwise the interval is split and the test repeats.",
        invariants: [
            "The substitution maps the positive t axis bijectively onto the interval (a, b).",
            "The number of sign changes bounds the root count with the same parity.",
            "Isolating intervals produced by different recursion branches are disjoint.",
        ],
        correctness:
            "Descartes' rule says the number of positive roots of q equals its sign changes minus an even nonnegative amount, so zero changes means no roots and one change means exactly one. The Mobius substitution is a bijection from positive t to the open interval (a, b), so positive roots of q correspond one-to-one with roots of p in that interval. Recursing until each branch has at most one sign change therefore yields a disjoint collection each containing exactly one root.",
        complexityRationale:
            "Each transform expands a degree d polynomial into d+1 coefficients with a double sum, costing O(d^2) arithmetic. Bisection adds at most maxDepth levels, so each isolated interval needs O(maxDepth * d^2) work and the stored coefficients use O(d) space per active branch.",
        uses: [
            "Exact real-root isolation in computer algebra systems",
            "Preprocessing for numerical root solvers to guarantee one root per bracket",
            "Sign determination for semialgebraic sets",
        ],
        references: [
            "Vincent, Sur la resolution des equations numeriques, 1834",
            "Akritas, Vincent's theorem and the Descartes method, 2010",
        ],
        workedExample:
            "For (x+1)(x-0.5)(x-2) on [-4, 4], the initial transform has three sign changes, so the interval is split. Branches with no sign changes are discarded, and branches with one change are kept, yielding three small intervals around minus one, one half, and two.",
    },
};

export default module;
