/**
 * private-aggregation.ts - Secure Sum by Additive Masking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Secure aggregation lets an untrusted collector learn the sum of several
 * parties' values without learning any individual value. For every pair of
 * parties a random mask is generated; the lower-indexed party adds it and the
 * higher-indexed party subtracts it. When all masked values are added, every
 * pairwise mask cancels, leaving exactly the sum of the original values.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p^2) to generate one mask per pair of p parties, plus O(p) to sum
 *   Space: O(p^2) for the pairwise masks and O(p) for the masked values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per party shows its true value and its masked value.
 *   - The aggregator's cell is CYAN and the final sum GREEN.
 *   - meta carries the pairwise masks, the masked values, and the aggregate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AggregationInput {
    values?: number[];
    seed?: number;
    mod?: number;
}

function makeCells(values: number[], masked: number[], stage: number): VisualEntity[] {
    const cells: VisualEntity[] = values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `party ${index}: ${value} -> ${masked[index] ?? 0}`,
        value,
        state: stage >= 2 ? "sorted" : index === 0 ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, party: index, value, masked: masked[index] ?? 0 },
    }));
    if (stage >= 3) {
        const total = values.reduce((sum, value) => sum + value, 0);
        cells.push({
            id: "cell-aggregate",
            type: "cell" as const,
            label: `aggregate ${total}`,
            value: total,
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: values.length, role: "aggregate" },
        });
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AggregationInput | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((value) => Math.max(0, Math.floor(Number(value) || 0)))
        : [12, 7, 20, 5];
    const mod = Math.max(1, Math.floor(Number(task.mod) || 256));
    const seed = Math.floor(Number(task.seed) || 13) >>> 0 || 1;
    let rng = seed;
    const masked = values.map(() => 0);
    const masks: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(values, masked, 0),
        edges: [],
        description: `Secure aggregation of ${values.length} value(s) modulo ${mod} using seed ${seed}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: values.length, mod, seed, values, masked, masks, aggregate: -1 },
    };
    let step = 1;

    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            rng = (Math.imul(1103515245, rng) + 12345) >>> 1;
            const mask = rng % mod;
            masks.push(mask);
            masked[i] = ((masked[i] ?? 0) + mask) % mod;
            masked[j] = (((masked[j] ?? 0) - mask) % mod + mod) % mod;
            yield {
                stepNumber: step,
                entities: makeCells(values, masked, 1),
                edges: [],
                description: `Pair (${i}, ${j}): party ${i} adds mask ${mask} and party ${j} subtracts it.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: {
                    rows: 1,
                    cols: values.length,
                    mod,
                    seed,
                    values,
                    masked: [...masked],
                    masks: [...masks],
                    aggregate: -1,
                    pair: [i, j],
                },
            };
            step += 1;
        }
    }

    const plainSum = values.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < masked.length; i += 1) {
        masked[i] = (((masked[i] ?? 0) + (values[i] ?? 0)) % mod + mod) % mod;
    }
    const aggregate = masked.reduce((sum, value) => (sum + value) % mod, 0);
    yield {
        stepNumber: step,
        entities: makeCells(values, masked, 2),
        edges: [],
        description: `Each party adds its true value to its masked share before sending it.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 1,
            cols: values.length,
            mod,
            seed,
            values,
            masked: [...masked],
            masks,
            aggregate: -1,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(values, masked, 3),
        edges: [],
        description: `All pairwise masks cancel; the collector sums masked shares to get ${aggregate}, which equals the true sum ${plainSum} modulo ${mod}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: values.length + 1,
            mod,
            seed,
            values,
            masked,
            masks,
            aggregate,
            plainSum,
            correct: aggregate === plainSum % mod,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Everyone adds a random mask to their value and a matching opposite mask to a neighbor, so the masks vanish when the collector adds everything up. Each individual masked value looks random, but the total is exact. The trick is pairwise: for every pair one side adds a shared random number and the other subtracts the same number.",
        invariants: [
            "For each pair, one party adds a mask and the other subtracts the identical mask.",
            "All pairwise masks sum to zero across the parties.",
            "The aggregate of masked values equals the aggregate of true values modulo the chosen modulus.",
        ],
        correctness:
            "A mask generated for pair (i, j) is added to party i and subtracted from party j, so it appears once with each sign in the total and cancels exactly. By induction over all pairs the sum of masked values differs from the sum of true values by zero modulo the modulus, which the final frame reports. The companion test reproduces the pair generation independently, checks the aggregate against the plain sum on random inputs, and verifies that individual masked values need not equal the true values.",
        complexityRationale:
            "Generating one mask for each of the p choose two pairs costs O(p^2), and summing the masked shares costs O(p), so time is O(p^2). Storing the pairwise masks uses O(p^2) space and the masked values O(p).",
        uses: [
            "Privacy-preserving sum queries across hospitals or organizations",
            "Federated learning gradient aggregation without exposing updates",
            "A teaching model for additive-secret-sharing protocols",
        ],
        references: [
            "Bonawitz et al., Practical Secure Aggregation for Privacy-Preserving Machine Learning, 2017",
            "Shamir, How to Share a Secret, 1979",
        ],
        workedExample:
            "With values 12 and 7 and a pair mask of 5, party one sends 12 plus 5 and party two sends 7 minus 5. The collector adds 17 and 2 to get 19, which is exactly 12 plus 7; neither masked value alone reveals its owner's contribution.",
    },
    id: "private-aggregation",
    name: "Secure Aggregation by Masking",
    category: "cryptography-security",
    complexity: { time: "O(p^2)", space: "O(p^2)" },
    defaultInput: { values: [12, 7, 20, 5], seed: 13, mod: 256 },
    visualType: "grid",
    run,
    pseudocode: [
        "agree on a modulus and a random seed",
        "for every pair of parties generate one shared random mask",
        "the lower-indexed party adds the mask and the higher-indexed party subtracts it",
        "each party adds its true value to its masked share",
        "each party sends only the masked share to the collector",
        "the collector sums all masked shares modulo the modulus",
        "the pairwise masks cancel, leaving the sum of the true values",
        "done: report the aggregate and the masked shares",
    ],
};

export default module;
