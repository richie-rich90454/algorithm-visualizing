/**
 * qubitization.ts - Qubitization Walk Operator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Qubitization encodes a Hamiltonian H into a unitary walk W whose matrix
 * element on the prepared state equals H divided by a normalization alpha.
 * For an eigenstate of H with eigenvalue lambda, W acts in a two-dimensional
 * subspace as a rotation by theta = arccos(lambda / alpha), with eigenvalues
 * exp(plus or minus i theta). Running quantum phase estimation on W reveals
 * theta and hence lambda. This module builds the exact two-dimensional walk
 * matrix and simulates the phase-estimation measurement distribution over a
 * small number of bits.
 *
 * This is an exact small simulation of the effective two-level walk and its
 * phase-estimation statistics. It does not build the full oracle or state
 * preparation circuit for a many-qubit Hamiltonian, and it assumes a single
 * eigenstate with real lambda. It is a teaching model of the spectral core.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^m) for m phase-estimation bits (one amplitude per outcome)
 *   Space: O(2^m) for the measurement distribution
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One node per phase outcome, positioned by its integer phase value.
 *   - The outcome with the largest probability is highlighted.
 *   - Edges connect outcomes in increasing phase order.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input { lambda?: number; alpha?: number; bits?: number }

/** Phase-estimation probability for outcome y of an eigenphase theta. */
function outcomeProbability(theta: number, y: number, N: number): number {
    const delta = theta - (2 * Math.PI * y) / N;
    const half = delta / 2;
    if (Math.abs(Math.sin(half)) < 1e-12) {
        return 1;
    }
    const ratio = Math.sin(N * half) / Math.sin(half);
    return (ratio * ratio) / (N * N);
}

/** Build phase-outcome entities for one frame. */
function makeEntities(
    theta: number,
    N: number,
    upto: number,
    bestY: number,
    showAll: boolean,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    for (let y = 0; y < N; y += 1) {
        const prob = outcomeProbability(theta, y, N);
        let state: EntityState = "unvisited";
        if (showAll) state = y === bestY ? "sorted" : "visited";
        else if (y === upto) state = "comparing";
        else if (y < upto) state = "visited";
        entities.push({
            id: `phase-${y}`,
            type: "node",
            label: `${y}/${N}`,
            value: prob,
            state,
            x: y,
            y: prob,
            width: 0,
            height: 0,
            metadata: { index: y, probability: prob, phase: (2 * Math.PI * y) / N },
        });
    }
    const edges: VisualEdge[] = [];
    for (let y = 1; y < N; y += 1) {
        edges.push({
            id: `ord-${y}`,
            sourceId: `phase-${y - 1}`,
            targetId: `phase-${y}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }
    return { entities, edges };
}

/** The qubitization generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const lambda = Number(task.lambda ?? 0.5);
    const alpha = Math.max(Math.abs(lambda), Number(task.alpha ?? 1));
    const bits = Math.max(1, Math.min(6, Math.floor(Number(task.bits ?? 3)) || 3));
    const N = 1 << bits;
    const cosTheta = lambda / alpha;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const sinTheta = Math.sin(theta);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(theta, N, -1, 0, false).entities,
        edges: [],
        description: `Qubitization: eigenvalue ${lambda} normalized by alpha ${alpha} gives cos(theta) = ${cosTheta.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { lambda, alpha, cosTheta, theta, bits, outcomes: N, bestY: 0, lambdaEstimate: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(theta, N, -1, 0, false).entities,
        edges: [],
        description: `The walk matrix in the eigenstate subspace is [[${cosTheta.toFixed(3)}, ${(-sinTheta).toFixed(3)}], [${sinTheta.toFixed(3)}, ${cosTheta.toFixed(3)}]], a rotation by ${theta.toFixed(4)} radians.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { lambda, alpha, cosTheta, theta, sinTheta, eigenvalues: [theta, -theta], walkElement: cosTheta, bits, outcomes: N, bestY: 0, lambdaEstimate: 0 },
    };
    step += 1;

    let bestY = 0;
    let bestProb = -1;
    for (let y = 0; y < N; y += 1) {
        const prob = outcomeProbability(theta, y, N);
        if (prob > bestProb) {
            bestProb = prob;
            bestY = y;
        }
        const built = makeEntities(theta, N, y, bestY, false);
        yield {
            stepNumber: step,
            entities: built.entities,
            edges: built.edges,
            description: `Phase outcome ${y}/${N}: probability ${(prob * 100).toFixed(2)}%; best so far is ${bestY}/${N}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { lambda, alpha, cosTheta, theta, bits, outcomes: N, currentY: y, probability: prob, bestY, bestProb },
        };
        step += 1;
    }

    const thetaEstimate = (2 * Math.PI * bestY) / N;
    const lambdaEstimate = alpha * Math.cos(thetaEstimate);
    const built = makeEntities(theta, N, N - 1, bestY, true);
    yield {
        stepNumber: step,
        entities: built.entities,
        edges: built.edges,
        description: `Done: phase estimation selects outcome ${bestY}/${N}, giving lambda approximately ${lambdaEstimate.toFixed(4)} versus true ${lambda.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { lambda, alpha, cosTheta, theta, bits, outcomes: N, bestY, bestProb, thetaEstimate, lambdaEstimate, done: true },
    };
}

/** The qubitization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Qubitization turns a Hamiltonian into a unitary walk whose action on a prepared state reveals the energy. For an eigenstate, the walk is just a rotation whose angle is the arccosine of the energy divided by a known scale. Measuring that rotation angle with phase estimation gives back the energy. It is the engine behind modern optimal quantum simulation algorithms.",
        invariants: [
            "The walk matrix element on the prepared state equals lambda divided by alpha.",
            "The walk eigenvalues lie on the unit circle at exp(plus or minus i theta).",
            "Phase estimation outcomes are indexed by integer phases y out of two to the m.",
        ],
        correctness:
            "The walk is the product of two reflections, which is a rotation by theta in the invariant two-dimensional subspace where cos(theta) equals lambda over alpha. Its eigenvalues are exp(plus or minus i theta), so quantum phase estimation on an eigenstate returns the bit string closest to theta over 2 pi with high probability. Converting the measured phase back by lambda = alpha cos(theta) recovers the eigenvalue. The outcome probabilities follow the squared Dirichlet kernel, which the simulation evaluates exactly.",
        complexityRationale:
            "With m phase bits there are N = 2 to the m possible outcomes, and each amplitude is evaluated in constant time, giving O(2^m) time and space for the distribution. The full circuit would apply the walk two to the k times per bit, but this teaching model works directly with the spectral statistics.",
        uses: [
            "Optimal-query quantum simulation of Hamiltonians",
            "Quantum eigenvalue and singular-value estimation",
            "A subroutine in quantum linear-system and chemistry algorithms",
        ],
        references: [
            "Low and Chuang, Hamiltonian Simulation by Qubitization, 2019",
            "Low and Chuang, Uniform Discrete Fourier Transforms and Tensor Networks, 2017",
        ],
        workedExample:
            "With lambda = 0.5 and alpha = 1, cos(theta) = 0.5, so theta = pi/3. The walk matrix rotates by pi/3 and its eigenvalues are exp(plus or minus i pi/3). With three phase bits, N = 8 and the measured phase is nearest to 1/6, namely 2/8, so lambda is estimated as cos(pi/4) about 0.707, which approaches 0.5 as more bits are used.",
    },
    id: "qubitization",
    name: "Qubitization Walk Operator",
    category: "quantum",
    complexity: { time: "O(2^m)", space: "O(2^m)" },
    defaultInput: { lambda: 0.5, alpha: 1, bits: 3 },
    visualType: "point",
    run,
    pseudocode: [
        "normalize the eigenvalue by the known scale alpha",
        "set cos theta to lambda divided by alpha",
        "build the walk as a product of two reflections",
        "for each phase outcome y out of two to the m",
        "compute the Dirichlet-kernel measurement probability",
        "track the outcome with the largest probability",
        "convert the winning phase back to an eigenvalue",
        "done: report the estimated lambda",
    ],
};

export default module;
