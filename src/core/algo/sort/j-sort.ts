/**
 * j-sort.ts - J-Sort (Prefix-Tree Sorting)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * J-sort sorts keys by their shared prefixes. It groups the keys by the first
 * character, then recursively sorts each group by the next character. A trie
 * is never built explicitly: the recursion over character positions plays the
 * role of a depth-first walk, and concatenating the groups in character order
 * yields lexicographic order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * L) for n keys of length L
 *   Space: O(n) for the group buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current array order during prefix grouping.
 *   - The segment being split by the current character is highlighted.
 *   - All bars turn green once full lexicographic order is reached.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Grouping {
    order: number[];
    highlight: number[];
    depth: number;
}

function makeBars(
    order: number[],
    values: number[],
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return order.map((valueIndex, position) => {
        const value = values[valueIndex] ?? 0;
        return {
            id: `bar-${position}`,
            type: "bar" as const,
            label: String(value),
            value,
            state: states.get(position) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: position, original: valueIndex },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const fallback = [31, 12, 23, 11, 30, 22];
    const raw = Array.isArray(input)
        ? (input as number[])
        : ((input as { values?: number[] } | null)?.values ?? fallback);
    const values = raw.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice();
    const words = values.map((v) => String(v));
    const order = values.map((_, i) => i);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(order, values),
        edges: [],
        description: `J-sort groups ${values.length} keys by shared prefixes, starting at the first character.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { keys: values.length, depth: 0 },
    };
    step += 1;

    if (values.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty input - there are no keys to group.",
            codeLineNumber: 0,
            layout: "array",
            meta: { keys: 0, depth: 0 },
        };
        return;
    }

    function* group(indices: number[], depth: number): Generator<Grouping, void, unknown> {
        if (indices.length <= 1) {
            return;
        }
        const ended: number[] = [];
        const groups = new Map<string, number[]>();
        for (const i of indices) {
            const word = words[i] ?? "";
            if (depth >= word.length) {
                ended.push(i);
                continue;
            }
            const letter = word.charAt(depth);
            const bucket = groups.get(letter);
            if (bucket) {
                bucket.push(i);
            } else {
                groups.set(letter, [i]);
            }
        }
        const letters = [...groups.keys()].sort();
        const arranged = [...ended];
        for (const letter of letters) {
            arranged.push(...(groups.get(letter) ?? []));
        }
        const position = order.indexOf(indices[0] ?? -1);
        if (position >= 0) {
            order.splice(position, indices.length, ...arranged);
        }
        yield {
            order: [...order],
            highlight: arranged.map((_, offset) => Math.max(0, position) + offset),
            depth,
        };
        for (const letter of letters) {
            yield* group(groups.get(letter) ?? [], depth + 1);
        }
    }

    for (const snapshot of group(order.slice(), 0)) {
        const states = new Map<number, EntityState>();
        for (const position of snapshot.highlight) {
            states.set(position, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(snapshot.order, values, states),
            edges: [],
            description: `Prefix position ${snapshot.depth}: split ${snapshot.highlight.length} keys into ${snapshot.highlight.length} ordered letter groups.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { keys: values.length, depth: snapshot.depth, groupSize: snapshot.highlight.length },
        };
        step += 1;
    }

    const allSorted = new Map<number, EntityState>();
    for (let i = 0; i < order.length; i += 1) {
        allSorted.set(i, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(order, values, allSorted),
        edges: [],
        description: `Done: prefix grouping produced the order ${order.map((i) => values[i]).join(", ")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { keys: values.length, result: order.map((i) => values[i]), depth: Math.max(1, ...words.map((w) => w.length)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine sorting words by walking a trie one letter at a time. J-sort splits the keys by their current character, keeps keys that already ended first, then recurses on each letter bucket with the next character. Reading the buckets left to right gives lexicographic order without ever building pointer nodes.",
        invariants: [
            "At prefix position d, keys in one bucket share the same first d characters.",
            "Keys whose length is at most d always precede longer keys with that same prefix.",
            "Buckets are concatenated in ascending character order at every recursion level.",
        ],
        correctness:
            "Lexicographic order compares the first differing character, or declares the shorter string smaller when one is a prefix of the other. Grouping by the current character fixes that first difference, the ended keys satisfy the prefix rule, and recursion fixes every later difference. By induction on prefix length the concatenation is exactly lexicographic order.",
        complexityRationale:
            "Each recursion level inspects every key in the current group once, and the deepest key has length L, so the total work is O(n*L). The group buffers at any one level hold at most n keys, giving O(n) extra space.",
        uses: [
            "Sorting strings with many shared prefixes such as URLs or file paths",
            "Building the leaf order of a prefix tree for autocomplete",
            "Teaching radix and trie-based sorting ideas",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2 (radix sorting)",
            "Sedgewick and Wayne, Algorithms, Section 5.2 (strings and radixes)",
        ],
        workedExample:
            "For keys 31, 12, 23, 11, 30, 22 the first character splits them into the 1-group (12, 11), the 2-group (23, 22), and the 3-group (31, 30). Recursing on the second character orders each pair, and concatenating yields 11, 12, 22, 23, 30, 31.",
    },
    id: "j-sort",
    name: "J-Sort (Prefix-Tree Sort)",
    category: "sorting",
    complexity: { time: "O(n * L)", space: "O(n)" },
    defaultInput: [31, 12, 23, 11, 30, 22],
    visualType: "array",
    run,
    pseudocode: [
        "write each key as its sequence of characters",
        "at prefix position d, group the current keys by character d",
        "place keys that already ended before all other groups",
        "recurse on each bucket using prefix position d+1",
        "concatenate buckets in ascending character order",
        "done: the concatenated order is lexicographic",
    ],
};

export default module;
