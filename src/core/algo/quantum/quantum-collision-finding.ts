/**
 * quantum-collision-finding.ts - Quantum Collision Finding (Birthday Search)
 *
 * A collision of a function f is a pair of distinct inputs x, y with f(x)=f(y).
 * Classically the birthday paradox needs about the square root of the range
 * size samples. The quantum birthday algorithm searches the space of input
 * pairs with amplitude amplification, finding a collision in roughly the cube
 * root of the number of inputs.
 *
 * This is an exact small-instance simulation, not a physical quantum device.
 * It enumerates the pair space to count marked states (the "oracle"), computes
 * the exact Grover iteration count and success probability, and reports the
 * first marked pair as the deterministic outcome of a successful measurement.
 * Limits: the function is a supplied lookup table; N is small; measurement
 * randomness is replaced by picking a valid marked pair.
 *
 * Time: O(N^2) enumeration in the simulator; ideal query complexity O(N^(1/3)).
 * Space: O(N^2) for the enumerated pair list.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Pair = [number, number];

function makeCells(values: number[], highlighted: Pair | null): VisualEntity[] {
    return values.map((value, index) => {
        const isPair = highlighted !== null && (index === highlighted[0] || index === highlighted[1]);
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `x${index}:${value}`,
            value,
            state: isPair ? ("path" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, output: value, row: 0, col: index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = task.values ?? [0, 1, 2, 0, 3, 1, 4, 2, 5, 3, 6, 4];
    const n = values.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(values, null),
        edges: [],
        description: `Loaded a ${n}-input function table; searching for two inputs with equal outputs.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, pairSpace: (n * (n - 1)) / 2, values: values.slice() },
    };
    step += 1;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeCells(values, null),
            edges: [],
            description: "At least two inputs are needed to form a collision pair.",
            codeLineNumber: 3,
            layout: "grid",
            meta: { found: false, pairSpace: 0 },
        };
        return;
    }

    const good: Pair[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (values[i] === values[j]) {
                good.push([i, j]);
            }
        }
    }
    const pairSpace = (n * (n - 1)) / 2;
    const marked = good.length;
    yield {
        stepNumber: step,
        entities: makeCells(values, null),
        edges: [],
        description: `Oracle marks ${marked} colliding pair(s) among ${pairSpace} possible pairs.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { pairSpace, marked, goodPairs: good },
    };
    step += 1;

    if (marked === 0) {
        yield {
            stepNumber: step,
            entities: makeCells(values, null),
            edges: [],
            description: "No marked pair exists, so the function is injective on this table.",
            codeLineNumber: 3,
            layout: "grid",
            meta: { found: false, pairSpace, marked: 0 },
        };
        return;
    }

    const sinTheta = Math.sqrt(marked / pairSpace);
    const iterations = Math.max(0, Math.floor((Math.PI / (4 * sinTheta)) - 0.5));
    const angle = (2 * iterations + 1) * Math.asin(Math.min(1, sinTheta));
    const probability = Math.min(1, Math.sin(angle) ** 2);
    yield {
        stepNumber: step,
        entities: makeCells(values, null),
        edges: [],
        description: `Grover amplification uses ${iterations} iteration(s); success probability ${(probability * 100).toFixed(1)} percent.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            iterations,
            sinTheta,
            probability,
            idealQueryComplexity: Math.ceil(Math.cbrt(n)),
        },
    };
    step += 1;

    const pair = good[0] as Pair;
    yield {
        stepNumber: step,
        entities: makeCells(values, pair),
        edges: [],
        description: `Measured inputs ${pair[0]} and ${pair[1]}, both mapping to output ${values[pair[0]]}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            found: true,
            pair,
            output: values[pair[0]],
            pairSpace,
            marked,
            iterations,
            probability,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of every unordered pair of inputs as a candidate answer. A tiny fraction of those pairs actually collide. Amplitude amplification repeatedly rotates the quantum state toward the colliding pairs, so after only about the cube root of the input count a measurement is likely to return one. The simulator makes the marked set explicit and applies the exact rotation count.",
        invariants: [
            "A marked pair always consists of two different input indices with the same output value.",
            "The marked count is computed by exhaustive enumeration of all input pairs.",
            "The Grover angle uses the exact ratio of marked pairs to total pairs.",
        ],
        correctness:
            "The oracle marks exactly the colliding pairs, so any measured marked pair is a genuine collision by construction. Grover's analysis gives success probability sin squared of (2k+1) theta where sin squared theta is the marked fraction; choosing k near pi over four theta maximizes it. The simulator computes this exactly and only returns a pair from the marked set, so when it reports a pair the collision property is guaranteed.",
        complexityRationale:
            "The simulator enumerates all pairs once, costing O(N^2) time and space. The ideal quantum algorithm uses O(N^(1/3)) oracle queries because the marked fraction is about 1 over N.",
        uses: [
            "Finding hash collisions in cryptanalysis",
            "Detecting duplicate records with quantum speedup",
            "Subroutine in quantum algorithms for element distinctness",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
            "Ambainis, Quantum Walk Algorithm for Element Distinctness, SIAM Journal on Computing 2007",
        ],
        workedExample:
            "For the table [0,1,2,0,3,1] there are 15 input pairs and two colliding pairs: (0,3) with output 0 and (1,5) with output 1. The marked fraction is 2/15, so about two Grover iterations amplify a marked pair to high probability, and the measurement may return (0,3) mapping to 0.",
    },
    id: "quantum-collision-finding",
    name: "Quantum Collision Finding",
    category: "quantum",
    complexity: { time: "O(N^2) simulator / O(N^(1/3)) queries", space: "O(N^2)" },
    defaultInput: { values: [0, 1, 2, 0, 3, 1, 4, 2, 5, 3, 6, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the function table with n inputs",
        "enumerate every unordered pair of inputs",
        "mark pairs whose two outputs are equal",
        "if no pair is marked report that the function is injective",
        "compute the Grover iteration count from the marked fraction",
        "amplify the marked subspace with that many iterations",
        "measure and output a colliding pair",
    ],
};

export default module;
