/**
 * subset-sum-quantum.ts - Quantum Search for Subset Sum
 *
 * Subset sum asks whether some subset of a list of positive integers adds up
 * to a target. A classical exhaustive search tries all 2^n subsets. Grover
 * search treats each subset as a search item and marks those whose sum is the
 * target, finding a solution in about the square root of 2^n evaluations.
 *
 * This is an exact small simulation. It enumerates all subsets to count the
 * marked ones, computes the exact Grover iteration count and success
 * probability, and reports the first marked subset as the deterministic
 * outcome of a successful measurement. Limits: n is small, values are
 * nonnegative, and measurement randomness is replaced by picking a valid
 * marked subset.
 *
 * Time: O(n 2^n) enumeration in the simulator; ideal query complexity O(2^(n/2)).
 * Space: O(2^n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], chosen: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `w${index}=${value}${chosen.includes(index) ? "*" : ""}`,
        value,
        state: chosen.includes(index) ? ("sorted" as const) : (index === active ? ("active" as const) : ("idle" as const)),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value, chosen: chosen.includes(index) },
    }));
}

function subsetSum(values: number[], mask: number): number {
    let sum = 0;
    for (let i = 0; i < values.length; i += 1) {
        if (((mask >> i) & 1) === 1) {
            sum += values[i] as number;
        }
    }
    return sum;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; target?: number } | null) ?? {};
    const values: number[] = task.values ?? [3, 1, 7, 2, 9, 4];
    const target = Number(task.target ?? 10);
    const n = values.length;
    const space = 2 ** n;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, [], -1),
        edges: [],
        description: `Search ${space} subsets of ${n} weights for a sum of ${target}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, space, target, values: values.slice() },
    };
    step += 1;

    const solutions: number[] = [];
    for (let mask = 0; mask < space; mask += 1) {
        if (subsetSum(values, mask) === target) {
            solutions.push(mask);
        }
    }
    const marked = solutions.length;
    yield {
        stepNumber: step,
        entities: makeBars(values, [], -1),
        edges: [],
        description: `The oracle marks ${marked} subset(s) out of ${space} whose weights sum to the target.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { space, marked, solutionMasks: solutions },
    };
    step += 1;

    if (marked === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(values, [], -1),
            edges: [],
            description: "No subset sums to the target; the oracle marks nothing.",
            codeLineNumber: 6,
            layout: "array",
            meta: { found: false, space, marked: 0 },
        };
        return;
    }

    const sinTheta = Math.sqrt(marked / space);
    const iterations = Math.max(0, Math.floor((Math.PI / (4 * sinTheta)) - 0.5));
    const angle = (2 * iterations + 1) * Math.asin(Math.min(1, sinTheta));
    const probability = Math.min(1, Math.sin(angle) ** 2);
    yield {
        stepNumber: step,
        entities: makeBars(values, [], -1),
        edges: [],
        description: `Grover uses ${iterations} iteration(s) for success probability ${(probability * 100).toFixed(1)} percent.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { iterations, sinTheta, probability, idealQueries: Math.ceil(Math.sqrt(space)) },
    };
    step += 1;

    const mask = solutions[0] as number;
    const chosen: number[] = [];
    for (let i = 0; i < n; i += 1) {
        if (((mask >> i) & 1) === 1) {
            chosen.push(i);
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, chosen, -1),
        edges: [],
        description: `Measured subset with indices [${chosen.join(", ")}] summing to ${subsetSum(values, mask)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            found: true,
            mask,
            chosen,
            sum: subsetSum(values, mask),
            target,
            space,
            marked,
            iterations,
            probability,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every subset is a candidate answer. Label a subset good when its weights add to the target. Grover search repeatedly nudges the quantum amplitude toward the good subsets, so after roughly the square root of the number of subsets a measurement is likely to give one. The simulator makes the good set explicit and applies the exact number of amplifying steps.",
        invariants: [
            "A marked subset is exactly one whose selected weights sum to the target.",
            "The marked count comes from a full enumeration of all two to the n subsets.",
            "The returned subset is always drawn from the marked set.",
        ],
        correctness:
            "The oracle marks precisely the subsets that solve the problem, so any returned marked subset is a valid solution. Grover's analysis gives success probability sin squared of (2k+1) theta with sin squared theta equal to the marked fraction; the chosen k maximizes this. Because the simulator only returns a subset from the marked list, the reported sum equals the target by construction.",
        complexityRationale:
            "Enumeration visits two to the n subsets and sums up to n weights each, costing O(n 2^n) time and O(2^n) space in the simulator. The ideal quantum search needs O(2^(n/2)) oracle queries.",
        uses: [
            "Solving small knapsack instances in cryptography teaching",
            "Subroutine in quantum algorithms for constraint satisfaction",
            "Finding exact change combinations in optimization",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
            "Grover, A Fast Quantum Mechanical Algorithm for Database Search, STOC 1996",
        ],
        workedExample:
            "For weights [3,1,7,2] and target 10, the subset with indices 1, 2 and 3 has sum 1+7+2=10 and is marked. With 16 total subsets and one or a few marked, about three Grover iterations make a measurement return a valid subset such as that one.",
    },
    id: "subset-sum-quantum",
    name: "Quantum Subset Sum Search",
    category: "quantum",
    complexity: { time: "O(n 2^n) simulator / O(2^(n/2)) queries", space: "O(2^n)" },
    defaultInput: { values: [3, 1, 7, 2, 9, 4], target: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "read the weights and the target sum",
        "enumerate every subset as a bit mask",
        "mark masks whose selected weights add to the target",
        "if none is marked report that no solution exists",
        "compute the Grover iteration count from the marked fraction",
        "amplify the marked subset states",
        "measure a marked subset and report its weights",
    ],
};

export default module;
