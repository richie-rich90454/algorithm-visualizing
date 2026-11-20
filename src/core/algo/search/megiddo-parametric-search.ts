/**
 * megiddo-parametric-search.ts - Megiddo Parametric Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A parametric search turns an optimization problem into a monotone decision
 * problem P(lambda). When the optimum is guaranteed to be one of a known set
 * of critical values, Megiddo's idea is to test a well chosen critical value
 * (the median of the remaining candidates) so that each decision call throws
 * away a fixed fraction of the candidates. This needs O(log n) decision calls
 * regardless of the numeric range. The module demonstrates the technique by
 * selecting the k-th smallest key: P(lambda) asks whether at least k values
 * are at most lambda, and the answer is the smallest critical value for which
 * P holds.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) setup plus O(log n) decision calls
 *   Space: O(n) for the sorted candidate list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The remaining candidate window is YELLOW (comparing).
 *   - The median candidate tested by the oracle is PURPLE (pivot).
 *   - The final selected key is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(sorted: number[], states: Map<number, EntityState>): VisualEntity[] {
    return sorted.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = !Array.isArray(input)
        ? ((input as { values?: number[]; k?: number } | null) ?? {})
        : {};
    const values = Array.isArray(input)
        ? [...(input as number[])]
        : Array.isArray(task.values)
          ? [...(task.values as number[])]
          : [9, 2, 7, 4, 1, 8, 3, 6, 5];
    const k = Math.max(1, Math.min(typeof task.k === "number" ? Math.floor(task.k) : 5, values.length));
    const sorted = [...values].sort((a, b) => a - b);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(sorted, new Map()),
        edges: [],
        description: `Parametric search for the ${k}-th smallest key via the decision oracle.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: sorted.length, k, calls: 0, candidates: new Set(values).size },
    };
    step += 1;

    if (sorted.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(sorted, new Map()),
            edges: [],
            description: "Empty input has no k-th smallest key.",
            codeLineNumber: 6,
            layout: "array",
            meta: { n: 0, k, calls: 0, answer: "none" },
        };
        return;
    }

    // Critical values are the distinct sorted keys.
    const candidates = [...new Set(sorted)].sort((a, b) => a - b);
    let lo = 0;
    let hi = candidates.length - 1;
    let calls = 0;

    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const threshold = candidates[mid] as number;
        calls += 1;
        // Decision oracle: are at least k values at most the threshold?
        let count = 0;
        for (const v of values) {
            if (v <= threshold) {
                count += 1;
            }
        }
        const feasible = count >= k;

        const states = new Map<number, EntityState>();
        for (const v of sorted) {
            const c = candidates.indexOf(v);
            if (c >= lo && c <= hi) {
                states.set(sorted.indexOf(v), "comparing");
            }
        }
        const pivotIndex = sorted.indexOf(threshold);
        states.set(pivotIndex, "pivot");
        yield {
            stepNumber: step,
            entities: makeBars(sorted, states),
            edges: [],
            description: `Test threshold ${threshold}: ${count} value(s) are at most it, ${feasible ? "enough" : "too few"} for k=${k}.`,
            codeLineNumber: feasible ? 3 : 4,
            layout: "array",
            meta: { n: sorted.length, k, calls, candidates: hi - lo + 1, threshold, feasible, lo, hi },
        };
        step += 1;

        // Keep the half of the critical values that can still contain the answer.
        if (feasible) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }

    const answer = candidates[lo] as number;
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < sorted.length; i += 1) {
        if (sorted[i] === answer) {
            finalStates.set(i, "sorted");
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(sorted, finalStates),
        edges: [],
        description: `The ${k}-th smallest key is ${answer}, found with ${calls} oracle call(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n: sorted.length, k, calls, candidates: 1, answer },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Parametric search replaces a hard optimization with a yes-or-no question about a candidate parameter value. If the answer must be one of a known list of critical values, test the median value: the yes-or-no result tells you which half still contains the optimum, so every call removes half the candidates and only logarithmically many calls are needed.",
        invariants: [
            "The decision predicate is monotone: once it holds for a threshold it holds for every larger one.",
            "The optimum is always one of the remaining critical values.",
            "Testing the median critical value discards a whole half of the candidates each round.",
        ],
        correctness:
            "The predicate P(lambda) = at least k values are at most lambda is monotone, and the smallest critical value where it holds is exactly the k-th smallest key. If P holds at the median, the optimum is at or below it, so the upper half is discarded; otherwise it is strictly above, so the lower half is discarded. Shrinking to one critical value therefore yields the correct k-th smallest key.",
        complexityRationale:
            "Sorting and building the distinct candidate set cost O(n log n). Each oracle call scans the n values once and there are O(log n) calls, giving O(n log n) total time and O(n) space for the sorted list and candidates.",
        uses: [
            "Selection and quantile computation",
            "Optimization where a fast decision procedure exists but direct optimization does not",
            "Computational-geometry problems such as the smallest maximum slope",
        ],
        references: [
            "Megiddo, Applying Parallel Computation Algorithms in the Design of Serial Algorithms, 1983",
            "Megiddo, Parallel Numerical Algorithms and Parametric Search, 1989",
        ],
        workedExample:
            "For values 9, 2, 7, 4, 1, 8, 3, 6, 5 and k=5, the candidates are 1 through 9. Testing threshold 5 finds five values at most 5, so the answer is at most 5; testing 3 finds three, so the answer is above 3; testing 4 finds four, so the 5th smallest key is 5.",
    },
    id: "megiddo-parametric-search",
    name: "Megiddo Parametric Search",
    category: "searching",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [9, 2, 7, 4, 1, 8, 3, 6, 5], k: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "sort the values and list the distinct critical keys",
        "set the candidate window to the whole critical list",
        "let mid be the median candidate and lambda its key",
        "ask the oracle how many values are at most lambda",
        "if at least k, keep the lower half including lambda",
        "otherwise keep the strictly upper half",
        "done: report the single remaining critical key",
    ],
};

export default module;
