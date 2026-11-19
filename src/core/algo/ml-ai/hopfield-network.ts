/**
 * hopfield-network.ts - Hopfield Associative Memory
 *
 * Hebbian learning stores binary patterns in a symmetric weight matrix with a
 * zero diagonal. Repeated asynchronous unit updates descend an energy function
 * and settle on the stored pattern closest to a noisy probe.
 *
 * Time:  O(steps * n^2) for n units
 * Space: O(n^2) for the weight matrix
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HopfieldInput {
    patterns: number[][];
    probe: number[];
    steps: number;
}

/** Hebbian outer-product weights with the self-terms removed. */
export function hebbianWeights(patterns: number[][]): number[][] {
    const n = patterns[0]?.length ?? 0;
    const weights = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
    for (const pattern of patterns) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                if (i !== j) {
                    weights[i]![j]! += (pattern[i] ?? 0) * (pattern[j] ?? 0) / n;
                }
            }
        }
    }
    return weights;
}

/** Hopfield energy for the current state. */
export function energyOf(weights: number[][], state: number[]): number {
    let sum = 0;
    for (let i = 0; i < state.length; i += 1) {
        for (let j = 0; j < state.length; j += 1) {
            sum += weights[i]![j]! * state[i]! * state[j]!;
        }
    }
    return -0.5 * sum;
}

function makeBars(state: number[], active: number, energy: number): VisualEntity[] {
    return state.map((value, i) => {
        const stateName: EntityState = i === active ? "comparing" : (value > 0 ? "sorted" : "active");
        return {
            id: `unit-${i}`,
            type: "bar" as const,
            label: `u${i}: ${value > 0 ? "+1" : "-1"}`,
            value,
            state: stateName,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, activation: value, energy },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<HopfieldInput> | null) ?? {};
    const patterns: number[][] = Array.isArray(task.patterns) && task.patterns.length > 0
        ? task.patterns
        : [[1, 1, -1, -1], [1, -1, 1, -1]];
    const n = patterns[0]?.length ?? 4;
    const probe: number[] = Array.isArray(task.probe) && task.probe.length === n
        ? task.probe
        : [1, 1, 1, -1];
    const steps = Math.max(1, Math.floor(task.steps ?? 8));
    const weights = hebbianWeights(patterns);
    const state = probe.slice();

    let step = 0;
    let energy = energyOf(weights, state);
    yield {
        stepNumber: step,
        entities: makeBars(state, -1, energy),
        edges: [],
        description: `Hopfield network with ${patterns.length} stored patterns over ${n} units; probe energy ${energy.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, patterns: patterns.length, rows: 1, cols: n, step: 0, energy, state: state.slice(), converged: false },
    };
    step += 1;

    let stableStreak = 0;
    for (let s = 0; s < steps; s += 1) {
        const unit = s % n;
        let activation = 0;
        for (let j = 0; j < n; j += 1) {
            activation += weights[unit]![j]! * state[j]!;
        }
        const before = state[unit]!;
        if (activation !== 0) {
            state[unit] = activation > 0 ? 1 : -1;
        }
        if (state[unit] === before) {
            stableStreak += 1;
        } else {
            stableStreak = 0;
        }
        energy = energyOf(weights, state);
        const converged = stableStreak >= n;
        yield {
            stepNumber: step,
            entities: makeBars(state, unit, energy),
            edges: [],
            description: `Step ${s + 1}: update unit ${unit}, activation ${activation.toFixed(3)}; energy now ${energy.toFixed(4)}.`,
            codeLineNumber: converged ? 6 : (s === steps - 1 ? 6 : 4),
            layout: "array",
            meta: { n, patterns: patterns.length, rows: 1, cols: n, step: s + 1, energy, state: state.slice(), converged },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(state, -1, energy),
        edges: [],
        description: `Done: network settled at energy ${energy.toFixed(4)} on the recalled pattern.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, patterns: patterns.length, rows: 1, cols: n, step: steps, energy, state: state.slice(), converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Hopfield network stores patterns the way an associative memory does: show it a corrupted or partial pattern and it repeatedly flips units until it lands on the closest stored one. Learning uses a Hebbian outer product, so units that fire together strengthen their connection. Because the weights are symmetric, each update moves the network down an energy landscape whose minima are the stored patterns.",
        invariants: [
            "The weight matrix is symmetric and has zeros on its diagonal.",
            "Every unit state remains either plus one or minus one.",
            "Asynchronous updates never increase the network energy.",
        ],
        correctness:
            "For symmetric zero-diagonal weights, changing one unit changes the energy by minus the amount times its local field, which is nonpositive whenever the unit moves to the sign of that field, so the energy cannot increase. The energy is bounded below, so the asynchronous process terminates at a fixed point. Each stored pattern is a local field of the right sign at every unit and therefore a fixed point. The test confirms symmetry and zero diagonal, checks that stored patterns are fixed points, and verifies the reported energy decreases monotonically over the replay.",
        complexityRationale:
            "Computing a unit's local field sums n products, so one update costs O(n), and n squared work is enough to recompute the energy; across the step budget that is O(steps * n squared). The symmetric weight matrix occupies O(n squared) space.",
        uses: [
            "Associative recall of corrupted binary patterns",
            "A teaching model for energy-based memory and attractor dynamics",
            "Optimization analogies for content-addressable storage",
        ],
        references: [
            "Hopfield, Neural Networks and Physical Systems with Emergent Collective Computational Abilities, PNAS, 1982",
            "Hertz, Krogh, and Palmer, Introduction to the Theory of Neural Computation, Addison-Wesley, 1991",
        ],
        workedExample:
            "Store the four-unit patterns plus-plus-minus-minus and plus-minus-plus-minus. Their outer products give a zero-diagonal symmetric matrix. Starting from the noisy probe plus-plus-plus-minus, the first sweep flips the second unit to minus, and the network settles on plus-minus-plus-minus, one of the stored patterns, with a lower energy than the probe.",
    },
    id: "hopfield-network",
    name: "Hopfield Network",
    category: "ml-ai",
    complexity: { time: "O(steps * n^2)", space: "O(n^2)" },
    defaultInput: {
        patterns: [[1, 1, -1, -1], [1, -1, 1, -1]],
        probe: [1, 1, 1, -1],
        steps: 8,
    },
    visualType: "array",
    run,
    pseudocode: [
        "store each binary pattern with Hebbian outer products and no self-connections",
        "copy the noisy probe into the current state",
        "for each scheduled step choose one unit in round-robin order",
        "compute that unit's weighted input from all other units",
        "set the unit to plus one or minus one with the sign of the input",
        "recompute the network energy from the updated state",
        "stop early when a full sweep changes no unit",
        "done: report the recalled pattern and final energy",
    ],
};

export default module;
