/**
 * shapley-shubik-power-index.ts - Shapley-Shubik Power Index
 *
 * In a weighted voting game, a voter's formal weight is a poor measure of
 * actual influence. The Shapley-Shubik index counts, over every possible
 * ordering of voters, how often a voter is pivotal: the one whose inclusion
 * first turns a losing coalition into a winning one. Dividing by the number
 * of orderings gives each voter's share of real power.
 *
 * Time:  O(n! * n); Space: O(n!) for the enumeration
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* permutations(items: number[]): Generator<number[]> {
    if (items.length === 0) {
        yield [];
        return;
    }
    for (let i = 0; i < items.length; i += 1) {
        const rest = items.slice(0, i).concat(items.slice(i + 1));
        for (const tail of permutations(rest)) yield [items[i]!, ...tail];
    }
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; quota?: number } | null) ?? {};
    const weights = task.weights ?? [4, 3, 2, 1];
    const quota = typeof task.quota === "number" ? task.quota : 6;
    const n = weights.length;
    const winning = (coalition: number[]): boolean =>
        coalition.reduce((sum, i) => sum + (weights[i] ?? 0), 0) >= quota;

    const pivotal = new Array<number>(n).fill(0);
    let total = 0;
    let step = 0;

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = weights.map((weight, i) => ({
            id: `voter-${i}`,
            type: "bar" as const,
            label: `w${i}=${weight}`,
            value: i === hot ? pivotal[i] ?? 0 : weight,
            state: (i === hot ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { voter: i, weight, pivotal: pivotal[i] ?? 0 },
        }));
        const powers = pivotal.map((count) => (total === 0 ? 0 : count / total));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                powers,
                pivotal: pivotal.slice(),
                orderings: total,
                quota,
                weights: weights.slice(),
            },
        };
    };

    yield frame(`Weighted game ${weights.join(",")} with quota ${quota}; enumerate orderings.`, 0, -1);
    step += 1;

    if (n > 0) {
        for (const order of permutations(weights.map((_, i) => i))) {
            total += 1;
            const before: number[] = [];
            for (const voter of order) {
                if (!winning(before) && winning([...before, voter])) {
                    pivotal[voter] = (pivotal[voter] ?? 0) + 1;
                    break;
                }
                before.push(voter);
            }
        }
    }

    for (let i = 0; i < n; i += 1) {
        yield frame(
            `Voter ${i} was pivotal ${pivotal[i] ?? 0} of ${total} orderings.`,
            3,
            i,
        );
        step += 1;
    }

    yield frame(`Done: Shapley-Shubik powers [${pivotal.map((c) => (total ? (c / total).toFixed(3) : "0")).join(", ")}].`, 5, -1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A voter with a large vote weight may still be irrelevant if coalitions win without them. The Shapley-Shubik index imagines voters arriving in every possible order and awards a point to whoever flips the coalition from losing to winning. A voter's power is the fraction of orderings in which they are that decisive swing voter.",
        invariants: [
            "A voter is pivotal only when adding them crosses the quota for the first time.",
            "At most one voter is pivotal in any single ordering.",
            "The power indices always sum to one when the quota is attainable.",
        ],
        correctness:
            "For each ordering the algorithm walks voters left to right and stops at the first prefix that reaches the quota, awarding that voter the pivotal point. This is exactly the definition of a pivotal voter. Summing over all n factorial orderings and dividing by their count gives the Shapley value of the simple voting game, which is the Shapley-Shubik power index.",
        complexityRationale:
            "There are n factorial orderings and each is scanned in at most n steps, costing O(n! n) time. The pivotal counts are O(n); the permutation generator holds one ordering at a time, so enumerating explicitly uses O(n!) time but only O(n) working space beyond the counters.",
        uses: [
            "Measuring influence in corporate shareholder votes",
            "Analyzing coalition power in legislatures",
            "Designing fair voting weights in committees",
        ],
        references: [
            "Shapley and Shubik, A Method for Evaluating the Distribution of Power in a Committee System, 1954",
            "Osborne, An Introduction to Game Theory, Chapter 13",
        ],
        workedExample:
            "With weights 4,3,2 and quota 5, consider the order 2,3,4. Alone neither 2 nor 3 reaches 5, but adding 4 reaches 9, so voter 4 is pivotal in that order. Averaging over all six orders gives voter weights of real power that differ from the raw vote weights.",
    },
    id: "shapley-shubik-power-index",
    name: "Shapley-Shubik Power Index",
    category: "game",
    complexity: { time: "O(n! n)", space: "O(n)" },
    defaultInput: { weights: [4, 3, 2, 1], quota: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize pivotal counts to zero for each voter",
        "generate every permutation of the voters",
        "walk the ordering adding voters to a coalition",
        "find the first voter that reaches the quota",
        "award that voter one pivotal point",
        "divide each count by the number of orderings",
        "done: report each voter's power index",
    ],
};

export default module;
