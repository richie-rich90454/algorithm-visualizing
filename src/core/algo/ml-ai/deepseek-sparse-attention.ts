/**
 * deepseek-sparse-attention.ts - DeepSeek Sparse Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DeepSeek sparse attention reduces the cost of long-context attention by
 * selecting only the most relevant keys for each query. A cheap relevance
 * score ranks all keys, the top k are kept, and full softmax attention is
 * applied only to that small subset. This keeps important long-range links
 * while avoiding a quadratic number of attention computations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 d) for scoring plus O(n k d) for the sparse attention
 *   Space: O(n^2) for the score matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the relevance scores, the chosen top-k key mask for each
 *     query, and the resulting sparse attention weights.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SparseAttentionInput {
    queries?: number[][];
    keys?: number[][];
    values?: number[][];
    topK?: number;
}

/** Indices of the k largest scores, in descending order with stable ties. */
export function topKIndices(scores: number[], k: number): number[] {
    return scores
        .map((score, index) => ({ score, index }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, Math.min(k, scores.length))
        .map((entry) => entry.index);
}

/** Sparse attention: select top-k keys per query, then softmax over them. */
export function sparseAttention(
    queries: number[][],
    keys: number[][],
    values: number[][],
    topK: number,
): { selected: number[][]; weights: number[][]; output: number[][] } {
    const n = queries.length;
    const d = queries[0]?.length ?? 1;
    const width = values[0]?.length ?? 1;
    const selected: number[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (const q of queries) {
        const scores = keys.map((key) =>
            q.reduce((sum, value, dim) => sum + value * (key[dim] ?? 0), 0) / Math.sqrt(d));
        const chosen = topKIndices(scores, topK);
        const chosenScores = chosen.map((index) => scores[index] ?? 0);
        const max = Math.max(...chosenScores);
        const exps = chosenScores.map((score) => Math.exp(score - max));
        const total = exps.reduce((a, b) => a + b, 0);
        const row = Array.from({ length: n }, () => 0);
        chosen.forEach((index, position) => { row[index] = (exps[position] ?? 0) / total; });
        selected.push(chosen);
        weights.push(row);
        output.push(Array.from({ length: width }, (_v, dim) =>
            row.reduce((sum, weight, j) => sum + weight * (values[j]?.[dim] ?? 0), 0)));
    }
    return { selected, weights, output };
}

function cells(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `c-${index}`,
        type: "cell" as const,
        label: value.toFixed(2),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SparseAttentionInput | null) ?? {};
    const queries: number[][] = task.queries ?? [[1, 0], [0, 1], [1, 1], [0.5, 0.5]];
    const keys: number[][] = task.keys ?? queries;
    const values: number[][] = task.values ?? queries;
    const topK = typeof task.topK === "number" ? Math.max(1, task.topK) : 2;
    const n = queries.length;
    const { selected, weights, output } = sparseAttention(queries, keys, values, topK);
    const scoreFlat = queries.map((q) => keys.map((key) =>
        q.reduce((sum, value, dim) => sum + value * (key[dim] ?? 0), 0) / Math.sqrt(q.length))).flat();
    const weightFlat = weights.flat();

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(scoreFlat.map(() => 0), scoreFlat.map(() => "unvisited")),
        edges: [],
        description: `Score all ${n} keys against each of the ${n} queries.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { n, topK, scores: [], selected: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(scoreFlat, scoreFlat.map(() => "comparing")),
        edges: [],
        description: `Compute scaled dot-product relevance scores for every query-key pair.`,
        codeLineNumber: 1,
        layout: "matrix",
        meta: { n, topK, scores: scoreFlat, selected: [], output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(weightFlat, weightFlat.map((v) => v > 0 ? "active" : "idle")),
        edges: [],
        description: `Keep only the top ${topK} keys per query and renormalize their weights.`,
        codeLineNumber: 2,
        layout: "matrix",
        meta: { n, topK, scores: scoreFlat, selected, output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(output.flat(), output.flat().map(() => "sorted")),
        edges: [],
        description: `Done: each query attends to only its ${topK} most relevant keys.`,
        codeLineNumber: 3,
        layout: "matrix",
        meta: { n, topK, scores: scoreFlat, selected, output: output.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full attention compares every query with every key, which becomes costly for long contexts. Sparse attention asks which keys actually matter for each query, keeps only the top few by a cheap score, and computes full attention on that short list. The hope is that the most relevant keys carry most of the signal needed for the task.",
        invariants: [
            "Each query keeps at most top-k keys.",
            "Sparse attention weights are zero for unselected keys and sum to one over selected keys.",
            "Ties in the relevance score are broken by smaller key index.",
        ],
        correctness:
            "Top-k selection by dot-product relevance is exactly the brute-force ranking of all keys, with a deterministic tie break. Applying softmax only to the selected scores makes those weights sum to one, so the output is a convex combination of the selected values just as in dense attention. The selected set is chosen before normalization, so the relative ordering within the subset is preserved, and restricting to the highest scores keeps the keys that contribute most to the dense attention distribution.",
        complexityRationale:
            "Scoring all query-key pairs costs O(n squared d). Selecting top k and computing attention over those costs O(n k d) more. The score matrix needs O(n squared) storage in this teaching implementation.",
        uses: [
            "Long-context language model inference",
            "Efficient retrieval-augmented attention over large key sets",
            "Sparse transformers for documents and code",
        ],
        references: [
            "DeepSeek-AI, DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model, arXiv 2024",
            "Child et al., Generating Long Sequences with Sparse Transformers, arXiv 2019",
        ],
        workedExample:
            "With four identical-style tokens and top-k of two, the first query scores highest against its identical key and its nearby keys. Only the two best keys receive nonzero softmax weights, and the output is the average of those two values.",
    },
    id: "deepseek-sparse-attention",
    name: "DeepSeek Sparse Attention",
    category: "ml-ai",
    complexity: { time: "O(n squared d)", space: "O(n squared)" },
    defaultInput: {
        queries: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
        keys: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
        values: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
        topK: 2,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "read queries, keys, values and the top-k count",
        "for each query score every key with a scaled dot product",
        "rank the keys and keep the top k indices",
        "apply softmax over only the selected scores",
        "average the selected values with those weights",
        "done: report the selected indices and sparse output",
    ],
};

export default module;
