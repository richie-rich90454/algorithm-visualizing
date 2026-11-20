/**
 * mapreduce-combiner.ts - MapReduce Combiner Phase
 *
 * A combiner is a local reducer that runs on each map split before the network
 * shuffle. When the reduce function is associative and commutative, combining
 * the (key, value) pairs locally produces exactly the same final answer while
 * shipping far fewer records. This module simulates map, combine, and reduce
 * and verifies that the combined path equals the uncombined path.
 *
 * Limit: word-count reducers over small in-memory document lists.
 *
 * Time:  O(total words + distinct words)
 * Space: O(total words + distinct words)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Pair {
    key: string;
    value: number;
}

function countPairs(pairs: Pair[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const pair of pairs) counts.set(pair.key, (counts.get(pair.key) ?? 0) + pair.value);
    return counts;
}

function sameCounts(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
        if (b.get(key) !== value) return false;
    }
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { documents?: string[] } | null) ?? {};
    const documents = task.documents ?? [
        "the cat sat on the mat",
        "the dog sat on the log",
        "a cat and a dog",
    ];

    const mapped: Pair[][] = documents.map((doc) =>
        doc
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length > 0)
            .map((key) => ({ key, value: 1 })),
    );
    const combined: Map<string, number>[] = mapped.map(countPairs);
    const final = countPairs(mapped.flat());
    const combinedFinal = new Map<string, number>();
    for (const local of combined) {
        for (const [key, value] of local) combinedFinal.set(key, (combinedFinal.get(key) ?? 0) + value);
    }
    const matches = sameCounts(final, combinedFinal);

    const words = [...final.keys()].sort();
    const entityFor = (counts: Map<string, number>, focus: string): VisualEntity[] =>
        words.map((word, index) => ({
            id: `word-${index}`,
            type: "cell" as const,
            label: `${word}: ${counts.get(word) ?? 0}`,
            value: counts.get(word) ?? 0,
            state: word === focus ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, word },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `MapReduce word count over ${documents.length} split(s); combiners run locally before the shuffle.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 0, cols: 0, splits: documents.length, records: mapped.reduce((n, m) => n + m.length, 0) },
    };
    step += 1;

    for (let i = 0; i < documents.length; i += 1) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: `Map split ${i}: emitted ${mapped[i]!.length} (word, 1) pairs from "${documents[i]}".`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 0, cols: 0, split: i, emitted: mapped[i]!.length },
        };
        step += 1;
    }

    for (let i = 0; i < combined.length; i += 1) {
        yield {
            stepNumber: step,
            entities: entityFor(combined[i]!, ""),
            edges: [],
            description: `Combiner on split ${i}: ${combined[i]!.size} distinct key(s), ${mapped[i]!.length} records collapsed.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: combined[i]!.size,
                split: i,
                localCounts: Object.fromEntries(combined[i]!),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: entityFor(final, ""),
        edges: [],
        description: `Reduce: ${words.length} distinct word(s); combined path ${matches ? "matches" : "does not match"} the direct path.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: words.length,
            matches,
            finalCounts: Object.fromEntries(final),
            combinedCounts: Object.fromEntries(combinedFinal),
        },
    };
}

const module: AlgorithmModule = {
    id: "mapreduce-combiner",
    name: "MapReduce Combiner",
    category: "parallel-distributed",
    complexity: { time: "O(W + K)", space: "O(W + K)" },
    defaultInput: {
        documents: ["the cat sat on the mat", "the dog sat on the log", "a cat and a dog"],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input split run the mapper and emit key-value pairs",
        "collect the emitted pairs for the split",
        "if a combiner is defined, aggregate pairs locally by key",
        "emit one combined record per distinct key",
        "shuffle all records to reducers grouped by key",
        "sum the values for each key in the reducer",
        "compare the combined result with the uncombined result",
        "done: report the final word counts",
    ],
    education: {
        intuition:
            "A combiner is a small reduce that runs where the map ran. If the reducer is just a sum or a maximum, adding two local sums gives the same answer as shipping every individual pair, so the network carries far fewer records. The trick only works because the operation is associative.",
        invariants: [
            "Every mapper emits exactly one pair per word with value one.",
            "A combiner only merges pairs of the same split and the same key.",
            "The combine-and-reduce path equals the direct-reduce path for an associative reducer.",
        ],
        correctness:
            "Word count reduces by addition. Addition is associative and commutative, so for every key the sum of the local sums equals the sum of all individual ones. Because the reducer groups strictly by key, no cross-key interaction exists, and the two paths produce identical maps.",
        complexityRationale:
            "Mapping visits each of the W words once. Combining touches each emitted pair once and stores K distinct keys. The reducer again touches each pair (or each combined record), so time and space are both O(W + K).",
        uses: [
            "Distributed word count and term-frequency pipelines",
            "Reducing shuffle traffic in large MapReduce jobs",
            "Pre-aggregating counters in analytics frameworks",
        ],
        references: [
            "Dean and Ghemawat, MapReduce: Simplified Data Processing on Large Clusters, 2004",
            "Lin and Dyer, Data-Intensive Text Processing with MapReduce",
        ],
        workedExample:
            "Split one holds 'the cat sat' and split two holds 'the dog sat'. Combiners emit (the,2),(cat,1),(sat,1) and (the,1),(dog,1),(sat,1). The reducer sums these to the=3, cat=1, sat=2, dog=1, exactly as if all six raw pairs had crossed the network.",
    },
};

export default module;
