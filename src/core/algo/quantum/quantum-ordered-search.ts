/**
 * quantum-ordered-search.ts - Quantum Ordered Search (Sorted List)
 *
 * Searches a sorted array for a target value by treating each index as a
 * search item. A quantum oracle marks the unique matching index, and amplitude
 * amplification rotates the uniform superposition toward it. The ideal query
 * cost grows as the square root of the list length rather than linearly.
 *
 * This is an exact small-instance simulation, not a physical quantum device.
 * It enumerates the list to locate the marked index, derives the exact Grover
 * iteration count and success probability, and returns the marked index as the
 * deterministic outcome of a successful measurement.
 *
 * Limits: the values must be sorted and distinct, the list is small, and
 * measurement randomness is replaced by selecting the marked index. No claim
 * is made that this beats classical binary search on a classical machine.
 *
 * Time: O(N) enumeration in the simulator; ideal queries O(sqrt N).
 * Space: O(N) for the displayed cells.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    values?: number[];
    target?: number;
}

function makeCells(values: number[], foundIndex: number | null): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `${index}:${value}`,
        value,
        state: index === foundIndex ? ("path" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value, row: 0, col: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.slice().map(Number)
        : [1, 3, 5, 7, 9, 11, 13, 15];
    const target = Number.isFinite(task.target) ? Number(task.target) : 11;
    const n = values.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(values, null),
        edges: [],
        description: `Search a sorted list of ${n} values for target ${target} with amplitude amplification.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, target, values: [...values], found: false },
    };
    step += 1;

    let markedIndex = -1;
    for (let i = 0; i < n; i += 1) {
        if (values[i] === target) {
            markedIndex = i;
            break;
        }
    }
    const marked = markedIndex >= 0 ? 1 : 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, null),
        edges: [],
        description: `The oracle marks ${marked} index for target ${target}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { n, target, marked, markedIndex, found: marked === 1 },
    };
    step += 1;

    if (marked === 0) {
        yield {
            stepNumber: step,
            entities: makeCells(values, null),
            edges: [],
            description: `Target ${target} is absent from the sorted list.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { n, target, marked: 0, found: false, iterations: 0 },
        };
        return;
    }

    const sinTheta = Math.sqrt(1 / n);
    const iterations = Math.max(0, Math.floor(Math.PI / (4 * sinTheta) - 0.5));
    const angle = (2 * iterations + 1) * Math.asin(Math.min(1, sinTheta));
    const probability = Math.min(1, Math.sin(angle) ** 2);
    yield {
        stepNumber: step,
        entities: makeCells(values, null),
        edges: [],
        description: `Amplification uses ${iterations} Grover iteration(s) with success probability ${(probability * 100).toFixed(1)} percent.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, target, marked: 1, iterations, sinTheta, probability, idealQueries: Math.ceil(Math.sqrt(n)) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(values, markedIndex),
        edges: [],
        description: `Measured index ${markedIndex}, which holds the target value ${target}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, target, marked: 1, found: true, index: markedIndex, value: values[markedIndex], iterations, probability },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The sorted order is not actually used by amplitude amplification; each index is simply a candidate. A quantum oracle flips the sign of the one candidate whose value matches the target, and repeated reflection about the uniform state grows that candidate's amplitude. After about the square root of the list length of repetitions, a measurement returns the matching index with high probability.",
        invariants: [
            "The values are sorted and distinct, so at most one index can be marked.",
            "The marked count is either zero or one.",
            "The Grover angle uses the exact ratio of marked states to the list length.",
        ],
        correctness:
            "Because values are distinct, the scan marks exactly the index holding the target, so a measured marked index is correct by construction. Grover's analysis gives success probability sin squared of (2k+1) theta where sin squared theta equals the marked fraction 1/N; the chosen k maximizes this probability. The test checks the returned index against an independent linear scan and recomputes the iteration count and probability.",
        complexityRationale:
            "The simulator scans the list once, costing O(N) time and O(N) displayed cells. The ideal quantum algorithm needs O(sqrt N) oracle queries, which is the quadratic speedup over brute-force search; classical binary search remains asymptotically faster but uses a comparison oracle rather than this amplitude model.",
        uses: [
            "Searching an unsorted or implicitly represented index set",
            "A subroutine in amplitude-amplification based quantum algorithms",
            "Teaching the difference between query models and wall-clock runtime",
        ],
        references: [
            "Grover, A Fast Quantum Mechanical Algorithm for Database Search, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "For the sorted list [1,3,5,7,9,11,13,15] and target 11, the oracle marks index 5. With eight items the marked fraction is one eighth, so about two Grover iterations amplify the marked state to nearly unit probability and the measurement returns index 5, whose value is 11.",
    },
    id: "quantum-ordered-search",
    name: "Quantum Ordered Search",
    category: "quantum",
    complexity: { time: "O(N) simulator / O(sqrt N) queries", space: "O(N)" },
    defaultInput: { values: [1, 3, 5, 7, 9, 11, 13, 15], target: 11 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the sorted values and the target",
        "scan the list to find a matching index",
        "mark that index when the target is present",
        "if nothing is marked report that the target is absent",
        "compute the Grover count from the marked fraction",
        "amplify the marked state with that many iterations",
        "measure and report the matching index",
    ],
};

export default module;
