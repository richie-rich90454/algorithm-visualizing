/**
 * deeponet.ts - Deep Operator Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A DeepONet learns an operator, a mapping from an input function to an output
 * function. A branch network encodes the input function at fixed sensors into
 * a vector, while a trunk network encodes the query location. Their dot
 * product, plus a learned bias, is the predicted output value at that query.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(q * p) for q query points and latent width p
 *   Space: O(q) for the output values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the branch encoding, one trunk encoding, and the outputs.
 *   - The final frame lists every query's predicted value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DeepONetInput {
    branch?: number[];
    trunks?: number[][];
    bias?: number;
}

/** Evaluate the branch-trunk dot product plus bias at a single query. */
export function deepONet(branch: number[], trunk: number[], bias: number): number {
    const p = Math.min(branch.length, trunk.length);
    let sum = bias;
    for (let i = 0; i < p; i += 1) sum += (branch[i] ?? 0) * (trunk[i] ?? 0);
    return sum;
}

/** Evaluate the operator at every query location. */
export function deepONetBatch(branch: number[], trunks: number[][], bias: number): number[] {
    return trunks.map((trunk) => deepONet(branch, trunk, bias));
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeepONetInput | null) ?? {};
    const branch: number[] = task.branch ?? [1, -0.5, 2, 0.3];
    const trunks: number[][] = task.trunks ?? [
        [0.5, 1, -0.5, 2],
        [1, 0, 0.5, 1],
        [-1, 2, 1, 0],
    ];
    const bias = typeof task.bias === "number" ? task.bias : 0.1;
    const outputs = deepONetBatch(branch, trunks, bias);
    const first = trunks[0] ?? [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(branch, branch.map(() => "comparing")),
        edges: [],
        description: `Branch net encodes the input function into ${branch.length} latent values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "branch", bias, outputs: [], branch, trunk: first },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(first, first.map(() => "active")),
        edges: [],
        description: `Trunk net encodes the first of ${trunks.length} query locations.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "trunk", bias, outputs: [], branch, trunk: first },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(branch.map((v, i) => v * (first[i] ?? 0)), branch.map(() => "sorted")),
        edges: [],
        description: "Multiply branch and trunk features elementwise before summing.",
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "product", bias, outputs: [], branch, trunk: first },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(outputs, outputs.map(() => "active")),
        edges: [],
        description: `Done: predicted outputs at ${outputs.length} queries are ready.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", bias, outputs, branch, trunk: first, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A DeepONet splits the hard job of learning an operator into two simpler pieces. The branch network compresses the input function into a fixed vector of coefficients, and the trunk network turns a query coordinate into basis functions. Combining them with a dot product gives the output function value at that coordinate, and the same learned pieces work for any input function.",
        invariants: [
            "Branch and trunk vectors share the same latent width p.",
            "The output at a query is linear in the branch coefficients for a fixed trunk.",
            "A learned bias is added to every query's prediction.",
        ],
        correctness:
            "The dot product of the branch vector with a trunk vector is a linear combination of trunk basis functions whose coefficients are the branch outputs, which is exactly the DeepONet approximation formula. Adding the bias gives a constant basis term. Evaluating each query independently with the same branch vector implements a single operator applied at many locations, so the returned array is the discretized output function.",
        complexityRationale:
            "Each query multiplies and sums p latent pairs, costing O(p) per query and O(q p) for q queries. Only the q output values must be retained, giving O(q) space beyond the network parameters.",
        uses: [
            "Learning solution operators for partial differential equations",
            "Surrogate models for expensive physical simulations",
            "Real-time prediction across varying input functions",
        ],
        references: [
            "Lu, Jin and Karniadakis, Learning Nonlinear Operators via DeepONet, Nature Machine Intelligence 2021",
            "Kovachki et al., Neural Operator: Learning Maps Between Function Spaces, JMLR 2023",
        ],
        workedExample:
            "With branch vector (1, -0.5, 2, 0.3), trunk vector (0.5, 1, -0.5, 2) and bias 0.1, the products are 0.5, -0.5, -1 and 0.6. Their sum is -0.4, and adding the bias gives -0.3 as the predicted output at that query.",
    },
    id: "deeponet",
    name: "Deep Operator Network (DeepONet)",
    category: "ml-ai",
    complexity: { time: "O(q * p)", space: "O(q)" },
    defaultInput: {
        branch: [1, -0.5, 2, 0.3],
        trunks: [[0.5, 1, -0.5, 2], [1, 0, 0.5, 1], [-1, 2, 1, 0]],
        bias: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the branch vector, query trunk vectors and a bias",
        "encode the input function with the branch network",
        "for each query encode its location with the trunk network",
        "multiply branch and trunk features elementwise",
        "sum the products and add the bias for that query",
        "done: report the predicted outputs at all queries",
    ],
};

export default module;
