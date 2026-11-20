/**
 * mapreduce.ts - MapReduce Word Count
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MapReduce processes a large data set in three stages. The map stage turns
 * each input record into key-value pairs, the shuffle stage groups all pairs
 * with the same key, and the reduce stage folds each group into one result.
 * This module runs the canonical word-count job: each word becomes a pair
 * (word, 1) and reduce adds the counts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) map plus O(n) shuffle plus O(n) reduce for n tokens
 *   Space: O(k) for k distinct keys during shuffling
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The input tokens are shown as grid cells in map order.
 *   - The cell emitted in the current map step is highlighted.
 *   - The reduce stage shows one row per key with its running total.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Tokenize a list of lines into lowercase words. */
function tokenize(lines: string[]): string[] {
    const words: string[] = [];
    for (const line of lines) {
        for (const word of line.toLowerCase().split(/\s+/)) {
            if (word.length > 0) {
                words.push(word);
            }
        }
    }
    return words;
}

/** Build cells for the input tokens in a single row flow. */
function makeTokenCells(tokens: string[], active: Set<number>): VisualEntity[] {
    return tokens.map((word, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: word,
        value: word,
        state: active.has(index) ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/** Build a two-column key/count table for the reduce stage. */
function makeCountCells(
    keys: string[],
    totals: number[],
    upto: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < keys.length; i += 1) {
        const done = i < upto;
        entities.push({
            id: `key-${i}`,
            type: "cell" as const,
            label: keys[i] ?? "",
            value: keys[i] ?? "",
            state: done ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: 0 },
        });
        entities.push({
            id: `count-${i}`,
            type: "cell" as const,
            label: String(totals[i] ?? 0),
            value: totals[i] ?? 0,
            state: done ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: 1 },
        });
    }
    return entities;
}

/** The MapReduce word-count generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lines?: string[] } | null) ?? {};
    const lines = Array.isArray(task.lines) ? task.lines : ["the quick brown fox", "the quick blue fox"];
    const tokens = tokenize(lines);
    const distinct = [...new Set(tokens)].sort();

    yield {
        stepNumber: 0,
        entities: makeTokenCells(tokens, new Set()),
        edges: [],
        description: `MapReduce word count over ${lines.length} line(s) with ${tokens.length} token(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: Math.max(1, tokens.length), phase: "setup", emitted: 0 },
    };
    let frame = 1;

    for (let i = 0; i < tokens.length; i += 1) {
        yield {
            stepNumber: frame,
            entities: makeTokenCells(tokens, new Set([i])),
            edges: [],
            description: `Map: token ${i} "${tokens[i]}" emits the pair (${tokens[i]}, 1).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: Math.max(1, tokens.length), phase: "map", emitted: i + 1 },
        };
        frame += 1;
    }

    yield {
        stepNumber: frame,
        entities: makeTokenCells(tokens, new Set()),
        edges: [],
        description: `Shuffle: group the ${tokens.length} pairs into ${distinct.length} key group(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: Math.max(1, tokens.length), phase: "shuffle", emitted: tokens.length },
    };
    frame += 1;

    const counts = new Map<string, number>();
    for (const key of distinct) {
        counts.set(key, 0);
    }
    for (let i = 0; i < distinct.length; i += 1) {
        const key = distinct[i] ?? "";
        for (const token of tokens) {
            if (token === key) {
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
        const totals = distinct.map((k) => counts.get(k) ?? 0);
        yield {
            stepNumber: frame,
            entities: makeCountCells(distinct, totals, i + 1),
            edges: [],
            description: `Reduce: key "${key}" has total ${counts.get(key) ?? 0}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: Math.max(1, distinct.length),
                cols: 2,
                phase: "reduce",
                keys: [...distinct],
                values: totals,
            },
        };
        frame += 1;
    }

    const finals = distinct.map((key) => counts.get(key) ?? 0);
    yield {
        stepNumber: frame,
        entities: makeCountCells(distinct, finals, distinct.length),
        edges: [],
        description: `Job complete: ${distinct.length} key(s) reduced from ${tokens.length} pair(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: Math.max(1, distinct.length),
            cols: 2,
            phase: "done",
            keys: [...distinct],
            values: finals,
        },
    };
}

/** The MapReduce module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Break a big job into two user-written functions. Map turns each input record into key-value pairs, the framework gathers every pair with the same key, and reduce folds each group into a single answer. Word count is the smallest example that shows all three stages.",
        invariants: [
            "Every map call emits exactly one pair per input token.",
            "Shuffle groups pairs by key without changing any count.",
            "Each reduce value equals the number of tokens equal to its key.",
        ],
        correctness:
            "The map stage emits one count of one for each token, so the multiset of emitted pairs is in one-to-one correspondence with the input tokens. Shuffle partitions that multiset by key, and reduce adds the ones in each part. The sum is therefore the number of tokens with that key, which is the definition of a word count.",
        complexityRationale:
            "Map, shuffle, and reduce each visit every one of the n tokens once, so the total work is O(n). The shuffle holds k distinct keys, giving O(k) space for the result table.",
        uses: [
            "Large-scale log and clickstream aggregation",
            "Building inverted indexes for search engines",
            "Batch analytics over data sets that exceed one machine",
        ],
        references: [
            "Dean and Ghemawat, MapReduce: Simplified Data Processing on Large Clusters, 2004",
            "Lam, MapReduce and parallel DBMSs: friends or foes, 2010",
        ],
        workedExample:
            "For the lines 'the quick fox' and 'the quick blue', map emits ten pairs. Shuffle forms four groups, and reduce returns the: 2, quick: 2, fox: 1, blue: 1.",
    },
    id: "mapreduce",
    name: "MapReduce Word Count",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(k)" },
    defaultInput: { lines: ["the quick brown fox", "the quick blue fox"] },
    visualType: "grid",
    run,
    pseudocode: [
        "split every line into lowercase words",
        "for each word emit the pair (word, 1)",
        "collect all emitted pairs",
        "group pairs by their key",
        "for each distinct key form its group",
        "sum the ones in the group",
        "emit the key with its total",
        "done: report the count for every key",
    ],
};

export default module;
