/**
 * adaptive-quadrature.ts - Adaptive Simpson Quadrature
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adaptive Simpson quadrature estimates a definite integral by applying
 * Simpson's rule on an interval and then again on each half. The difference
 * between the one-panel estimate and the two half estimates approximates the
 * error; when that error is small enough the refined, extrapolated value is
 * accepted, otherwise the interval is split and each half is tested again.
 * Error tolerance is halved at each split, so difficult regions are subdivided
 * finely while smooth regions are accepted quickly. The extrapolation adds
 * (S_left + S_right - S_whole) / 15, which cancels the leading error term.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(number of evaluated panels)
 *   Space: O(depth) for the recursion stack plus the interval log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid rows are the intervals examined, with estimate and error.
 *   - A row being tested is yellow; an accepted interval is green.
 *   - The final frame reports the integral estimate and error versus exact.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FunctionName = "x2" | "x3" | "sin" | "cos";

interface QuadInput {
    fn?: string;
    a?: number;
    b?: number;
    tol?: number;
    maxDepth?: number;
}

interface Interval {
    lo: number;
    hi: number;
    estimate: number;
    error: number;
    accepted: boolean;
    depth: number;
}

const NAMES: FunctionName[] = ["x2", "x3", "sin", "cos"];

function evaluate(fn: FunctionName, x: number): number {
    switch (fn) {
        case "x2":
            return x * x;
        case "x3":
            return x * x * x;
        case "sin":
            return Math.sin(x);
        case "cos":
            return Math.cos(x);
    }
}

function exactIntegral(fn: FunctionName, a: number, b: number): number {
    switch (fn) {
        case "x2":
            return (b ** 3 - a ** 3) / 3;
        case "x3":
            return (b ** 4 - a ** 4) / 4;
        case "sin":
            return Math.cos(a) - Math.cos(b);
        case "cos":
            return Math.sin(b) - Math.sin(a);
    }
}

/** Simpson estimate on [lo, hi] given endpoint and midpoint values. */
function simpson(lo: number, hi: number, flo: number, fmid: number, fhi: number): number {
    return ((hi - lo) / 6) * (flo + 4 * fmid + fhi);
}

function makeCells(intervals: Interval[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < intervals.length; i += 1) {
        const interval = intervals[i]!;
        const values = [
            `${interval.lo.toFixed(3)}..${interval.hi.toFixed(3)}`,
            interval.estimate.toFixed(6),
            interval.error.toExponential(2),
            interval.depth,
            interval.accepted ? "accept" : "split",
        ];
        for (let col = 0; col < 5; col += 1) {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell",
                label: String(values[col] ?? ""),
                value: values[col] ?? "",
                state: interval.accepted ? "sorted" : "comparing",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col, lo: interval.lo, hi: interval.hi, depth: interval.depth },
            });
        }
    }
    return entities;
}

/** The adaptive quadrature generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QuadInput | null) ?? {};
    const fn = NAMES.includes(task.fn as FunctionName) ? (task.fn as FunctionName) : "sin";
    const rawA = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 0;
    const rawB = typeof task.b === "number" && Number.isFinite(task.b) ? task.b : 1;
    const a = Math.min(rawA, rawB);
    const b = Math.max(rawA, rawB);
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-6;
    const maxDepth = Math.max(1, Math.min(20, Math.floor(task.maxDepth ?? 20)));
    const exact = exactIntegral(fn, a, b);
    const intervals: Interval[] = [];
    let step = 0;

    const meta = (estimate: number, done: boolean) => ({
        fn,
        a,
        b,
        tol,
        maxDepth,
        rows: intervals.length,
        cols: 5,
        accepted: intervals.filter((i) => i.accepted).length,
        estimate,
        exact,
        error: Math.abs(estimate - exact),
        done,
    });

    function* adapt(lo: number, hi: number, flo: number, fmid: number, fhi: number, whole: number, localTol: number, depth: number): Generator<VisualFrame, number, unknown> {
        const mid = (lo + hi) / 2;
        const flm = evaluate(fn, (lo + mid) / 2);
        const frm = evaluate(fn, (mid + hi) / 2);
        const left = simpson(lo, mid, flo, flm, fmid);
        const right = simpson(mid, hi, fmid, frm, fhi);
        const error = Math.abs(left + right - whole) / 15;
        const entry: Interval = { lo, hi, estimate: left + right, error, accepted: false, depth };
        intervals.push(entry);
        yield {
            stepNumber: step++,
            entities: makeCells(intervals),
            edges: [],
            description: `Testing [${lo.toFixed(3)}, ${hi.toFixed(3)}] at depth ${depth}: Simpson error estimate ${error.toExponential(2)} versus tolerance ${localTol.toExponential(2)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(left + right, false),
        };
        if (error <= localTol || depth >= maxDepth) {
            entry.accepted = true;
            const refined = left + right + (left + right - whole) / 15;
            yield {
                stepNumber: step++,
                entities: makeCells(intervals),
                edges: [],
                description: `Accept [${lo.toFixed(3)}, ${hi.toFixed(3)}] with corrected value ${refined.toFixed(9)}.`,
                codeLineNumber: error <= localTol ? 3 : 4,
                layout: "grid",
                meta: meta(refined, false),
            };
            return refined;
        }
        const l = yield* adapt(lo, mid, flo, flm, fmid, left, localTol / 2, depth + 1);
        const r = yield* adapt(mid, hi, fmid, frm, fhi, right, localTol / 2, depth + 1);
        return l + r;
    }

    yield {
        stepNumber: step++,
        entities: makeCells(intervals),
        edges: [],
        description: `Integrating ${fn} from ${a} to ${b} with tolerance ${tol.toExponential(2)} and max depth ${maxDepth}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, false),
    };

    const flo = evaluate(fn, a);
    const fmid = evaluate(fn, (a + b) / 2);
    const fhi = evaluate(fn, b);
    const whole = simpson(a, b, flo, fmid, fhi);
    const estimate = yield* adapt(a, b, flo, fmid, fhi, whole, tol, 0);

    yield {
        stepNumber: step,
        entities: makeCells(intervals),
        edges: [],
        description: `Estimate ${estimate.toFixed(10)} versus exact ${exact.toFixed(10)} (error ${Math.abs(estimate - exact).toExponential(2)}) after ${intervals.length} interval(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(estimate, true),
    };
}

/** The adaptive quadrature module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single Simpson panel is fast but can be wrong where a function bends sharply. Adaptive quadrature tries one panel, then two half panels, and compares them. If they disagree by more than the allowed error it keeps splitting that region and tries again, spending work only where the function is hard. A small extrapolation using the disagreement cancels most of the remaining error.",
        invariants: [
            "On every interval the two half estimates are computed from the same underlying function values as the whole estimate.",
            "The error tolerance is halved each time an interval is split.",
            "A refined value is accepted only when its estimated error is within tolerance or the depth limit is reached.",
        ],
        correctness:
            "Simpson's rule on an interval has error proportional to the fourth power of its width times the fourth derivative. The difference between the whole and the two half estimates is fifteen times the leading error of the refined value, so dividing by fifteen estimates that error and adding it back cancels the leading term. Recursing wherever the estimate exceeds the local tolerance drives the error below tolerance on each accepted interval, and summing accepted intervals gives the integral up to the requested accuracy.",
        complexityRationale:
            "Each tested interval evaluates the function at two new midpoints and does constant work, so time is proportional to the number of panels explored. Smooth functions need few panels, while functions with sharp features need more. The recursion stack holds at most maxDepth intervals and the log holds one entry per tested interval.",
        uses: [
            "Numerical integration in scientific libraries and computer algebra systems",
            "Accumulating quantities from expensive black-box functions",
            "Adaptive mesh refinement in physics and engineering solvers",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Section 4.7",
            "Press et al., Numerical Recipes, Section 4.2",
        ],
        workedExample:
            "Integrating sin from 0 to 1 with tolerance 1e-6: the whole interval and the two halves agree closely because sine is smooth there, so a single split is accepted. The refined value is about 0.45970, matching the exact result 1 minus cos(1) to within the tolerance.",
    },
    id: "adaptive-quadrature",
    name: "Adaptive Simpson Quadrature",
    category: "numerical-optimization",
    complexity: { time: "O(panels)", space: "O(depth + panels)" },
    defaultInput: { fn: "sin", a: 0, b: 1, tol: 1e-6, maxDepth: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "estimate the whole interval with one Simpson panel",
        "estimate each half with its own Simpson panel",
        "set the error to the difference divided by fifteen",
        "if the error is within tolerance accept the extrapolated sum",
        "otherwise split the interval and halve the tolerance",
        "recurse on the left half and then the right half",
        "stop at the depth limit even if the error is large",
        "done: report the summed integral and its error",
    ],
};

export default module;
