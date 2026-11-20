/**
 * entanglement-purification.ts - BBPSSW Recurrence Purification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The BBPSSW recurrence protocol takes two shared noisy Bell pairs, performs a
 * bilateral XOR and local measurements, and keeps the result only when the two
 * measurement outcomes agree. The kept pair has higher fidelity than either
 * input, at the cost of consuming two pairs and succeeding with a computable
 * probability. Repeating the round distills a high-fidelity pair from many
 * low-fidelity ones.
 *
 * ---------------------------------------------------------------------------
 * Limits of the simulation
 * ---------------------------------------------------------------------------
 *   - Werner states only, described completely by a single fidelity F.
 *   - Ideal gates and measurements; no gate error, loss, or memory decoherence.
 *   - Large-ensemble expectation values, so fidelity and yield are exact rationals.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) closed-form updates
 *   Space: O(rounds) for the emitted fidelity history
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PurificationInput {
    fidelity?: number;
    rounds?: number;
    pairs?: number;
}

/** BBPSSW output fidelity for a Werner input pair. */
function nextFidelity(f: number): number {
    const q = 1 - f;
    const numerator = f * f + (q * q) / 9;
    const denominator = f * f + (2 * f * q) / 3 + (5 * q * q) / 9;
    return denominator === 0 ? f : numerator / denominator;
}

/** Success probability of one BBPSSW round. */
function successProbability(f: number): number {
    const q = 1 - f;
    return f * f + (2 * f * q) / 3 + (5 * q * q) / 9;
}

function makeBars(history: number[], done: boolean): VisualEntity[] {
    return history.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === history.length - 1) {
            state = "comparing";
        }
        return {
            id: `round-${index}`,
            type: "bar" as const,
            label: value.toFixed(6),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { round: index, fidelity: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PurificationInput | null) ?? {};
    const clamp = (value: unknown, low: number, high: number, fallback: number): number =>
        typeof value === "number" && Number.isFinite(value)
            ? Math.max(low, Math.min(high, value))
            : fallback;
    const f0 = clamp(task.fidelity, 0.5, 1, 0.8);
    const rounds = Math.max(1, Math.min(20, Math.floor(clamp(task.rounds, 1, 20, 6))));
    let pairs = Math.max(1, Math.floor(clamp(task.pairs, 1, 1e12, 1000)));
    let fidelity = f0;
    const history: number[] = [f0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(history, false),
        edges: [],
        description: `Starting with ${pairs} Werner pairs at fidelity ${f0.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { fidelity, pairs, round: 0, probability: 1, converged: false },
    };
    step += 1;

    for (let round = 1; round <= rounds && pairs >= 2; round += 1) {
        const probability = successProbability(fidelity);
        const next = nextFidelity(fidelity);
        pairs = Math.floor((pairs * probability) / 2);
        fidelity = next;
        history.push(fidelity);
        const converged = fidelity > 1 - 1e-12;
        yield {
            stepNumber: step,
            entities: makeBars(history, false),
            edges: [],
            description: `Round ${round}: bilateral XOR keeps ${(probability * 100).toFixed(1)}% of pairs, raising fidelity to ${fidelity.toFixed(6)} with ${pairs} pair(s) left.`,
            codeLineNumber: converged ? 6 : 4,
            layout: "array",
            meta: { fidelity, pairs, round, probability, converged },
        };
        step += 1;
        if (converged) break;
    }

    yield {
        stepNumber: step,
        entities: makeBars(history, true),
        edges: [],
        description: `After ${history.length - 1} round(s), fidelity is ${fidelity.toFixed(6)} from ${pairs} remaining pair(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { fidelity, pairs, round: history.length - 1, probability: successProbability(fidelity), converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two imperfect entangled pairs can be traded for one better pair. Both parties apply the same XOR between their halves and measure the target pair; if their measurement results agree, the source pair is kept and is more strongly entangled than before. Repeating this filter drives the fidelity upward while steadily consuming pairs.",
        invariants: [
            "Fidelity stays in the interval between one half and one.",
            "Each successful round consumes two pairs and returns one.",
            "The success probability and the output fidelity are functions of F alone for Werner states.",
        ],
        correctness:
            "A Werner state is a mixture of the Bell state and three equally likely errors, so one parameter F fully describes it. Expanding the bilateral XOR and postselecting on agreeing measurement outcomes discards exactly the components that lower fidelity. The kept state's fidelity is the ratio of the Bell-component weight to the total keep probability, giving (F squared plus (one minus F) squared over nine) divided by (F squared plus two F(one minus F) over three plus five(one minus F) squared over nine). This exceeds F whenever F is above one half, so iteration increases fidelity toward one while the success probability bounds how many pairs survive.",
        complexityRationale:
            "Each round evaluates two constant-size rational formulas and updates one pair count, so time is O(rounds). The only growing structure is the fidelity history used for the bars, which is O(rounds).",
        uses: [
            "Distilling high-fidelity entanglement for quantum repeaters",
            "Preparing clean Bell pairs for teleportation and gate teleportation",
            "Fault-tolerant quantum network links",
        ],
        references: [
            "Bennett et al., Purification of Noisy Entanglement and Faithful Teleportation, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "Starting from F equal to 0.8, one BBPSSW round succeeds with probability about 0.769 and produces fidelity about 0.838. A second round raises it further near 0.866, showing the steady improvement that comes at the cost of roughly halving the number of pairs each time.",
    },
    id: "entanglement-purification",
    name: "Entanglement Purification",
    category: "quantum",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { fidelity: 0.8, rounds: 6, pairs: 1000 },
    visualType: "array",
    run,
    pseudocode: [
        "start with an ensemble of Werner pairs of fidelity F",
        "for each purification round while at least two pairs remain",
        "apply a bilateral XOR between two pairs",
        "measure the target pair on both sides and keep it only on agreement",
        "compute the success probability from F",
        "replace F by the BBPSSW output fidelity formula",
        "halve the pair count using the success probability",
        "stop when fidelity is essentially one or pairs run out",
        "done: report the final fidelity and surviving pair count",
    ],
};

export default module;
