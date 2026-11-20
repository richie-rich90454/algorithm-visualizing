/**
 * self-consistency-decoding.ts - Self-Consistency Decoding (Majority-Vote Core)
 *
 * TEACHING MODEL, NOT A SAMPLING PIPELINE. Self-consistency samples several
 * reasoning paths and keeps the answer that appears most often, instead of
 * trusting a single greedy path. This module implements exactly that tally and
 * its deterministic tie-break; the sampled answers are supplied as input so
 * the aggregation step can be verified exactly.
 *
 * Complexity:
 *   Time:  O(s) for s sampled answers
 *   Space: O(k) for k distinct answers
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value),
                value: value ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** Tally the samples and pick the most frequent answer, breaking ties by first appearance. */
function tally(samples: string[]) {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const answer of samples) {
        if (!counts.has(answer)) {
            order.push(answer);
            counts.set(answer, 0);
        }
        counts.set(answer, (counts.get(answer) ?? 0) + 1);
    }
    let winner = order[0] ?? "";
    for (const answer of order) {
        if ((counts.get(answer) ?? 0) > (counts.get(winner) ?? 0)) {
            winner = answer;
        }
    }
    return { order, counts, winner };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { samples?: string[] } | null) ?? {};
    const samples = (task.samples?.length ? task.samples : ["A", "B", "A", "A", "C", "B", "A"]).map(
        (answer) => String(answer),
    );
    const { order, counts, winner } = tally(samples);
    const width = Math.max(samples.length, 1);
    const codeOf = (answer: string) => Math.max(0, order.indexOf(answer));
    const row0: Cell[] = samples.map((_, i) => i);
    const row1: Cell[] = samples.map((answer) => codeOf(answer));
    const row2: Cell[] = samples.map((answer) => counts.get(answer) ?? 0);
    const row3: Cell[] = samples.map((answer) => (answer === winner ? 1 : 0));
    const matrix: Cell[][] = [row0, row1, row2, row3];
    const base = { rows: 4, cols: width, samples: samples.length, distinct: order.length };
    const voteLines = order.map((answer) => `${answer}: ${counts.get(answer)}`);

    const captions = [
        `Collect ${samples.length} sampled answers: ${samples.join(", ")}.`,
        "Encode each answer as the index of its first occurrence.",
        `Tally the votes: ${voteLines.join(", ")}.`,
        `The majority answer is ${winner} with ${counts.get(winner) ?? 0} vote(s).`,
    ];
    for (let frame = 0; frame < captions.length; frame += 1) {
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, frame + 1, frame),
            edges: [],
            description: captions[frame] ?? "",
            codeLineNumber: frame,
            layout: "grid",
            meta: {
                ...base,
                phase: frame === 0 ? "samples" : frame === 3 ? "result" : "tally",
                answers: order,
                counts: order.map((answer) => counts.get(answer) ?? 0),
                winner,
                winnerVotes: counts.get(winner) ?? 0,
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single chain of thought can reach a wrong answer even when the model usually reasons well. Self-consistency samples several independent reasoning paths and treats the most common final answer as the most trustworthy one, letting agreement across paths stand in for confidence.",
        invariants: [
            "Every sampled answer contributes exactly one vote.",
            "The tally counts are nonnegative and sum to the number of samples.",
            "The winner has the maximum count, with the earliest answer chosen on a tie.",
        ],
        correctness:
            "The tally partitions the samples into groups by their final answer, so the sum of the group counts equals the number of samples and every sample is counted once. Scanning the groups in first-appearance order and replacing the leader only on a strictly larger count guarantees the returned answer has maximal support and that ties resolve to the earliest answer.",
        complexityRationale:
            "Each of the s samples is inserted into a map and counted once, so the work is O(s) time. The map holds one entry per distinct answer, giving O(k) space.",
        uses: [
            "Improving reasoning accuracy without retraining a model",
            "Multiple-sample decoding for math and commonsense benchmarks",
            "A teaching model of vote aggregation over sampled outputs",
        ],
        references: [
            "Wang et al., Self-Consistency Improves Chain of Thought Reasoning, 2023",
            "Wei et al., Chain-of-Thought Prompting Elicits Reasoning, 2022",
        ],
        workedExample:
            "Given the seven samples A, B, A, A, C, B, A, the tally is A with 4, B with 2, and C with 1. The largest count is 4, so the selected answer is A.",
    },
    id: "self-consistency-decoding",
    name: "Self-Consistency Decoding (Majority-Vote Core)",
    category: "ml-ai",
    complexity: { time: "O(s)", space: "O(k)" },
    defaultInput: { samples: ["A", "B", "A", "A", "C", "B", "A"] },
    visualType: "grid",
    run,
    pseudocode: [
        "collect all sampled final answers",
        "map each distinct answer to its first appearance order",
        "increment the vote count for each sampled answer",
        "scan the answers in first appearance order",
        "keep the answer with the strictly largest count",
        "done: return the majority answer and its vote count",
    ],
};

export default module;
