/**
 * burst-sort.ts - Burst Sort.
 *
 * Burst sort is a cache-aware string sort. Strings are held in buckets of a
 * trie keyed by successive characters. A bucket that grows past a capacity is
 * "burst" into child buckets on the next character, and the process repeats.
 * Once no bucket overflows, each leaf bucket is small enough to sort directly
 * and an in-order traversal of the trie yields the fully sorted strings.
 *
 * Time O(total characters + bursts), space O(total characters).
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualEntity, VisualFrame } from "@/types";

interface TrieNode {
    children: Map<string, TrieNode>;
    bucket: string[];
    depth: number;
}

interface BurstResult {
    sorted: string[];
    bursts: number;
    maxDepth: number;
}

function burstSort(strings: string[], capacity: number): BurstResult {
    const root: TrieNode = { children: new Map(), bucket: [...strings], depth: 0 };
    let bursts = 0;
    let maxDepth = 0;
    const queue: TrieNode[] = [root];

    while (queue.length > 0) {
        const node = queue.shift() as TrieNode;
        if (node.bucket.length <= capacity) {
            continue;
        }
        const groups = new Map<string, string[]>();
        for (const str of node.bucket) {
            const key = node.depth < str.length ? (str[node.depth] as string) : "\u0000";
            const group = groups.get(key);
            if (group) {
                group.push(str);
            } else {
                groups.set(key, [str]);
            }
        }
        // Bursting into a single group would not shrink the bucket (identical
        // strings or strings shorter than the depth), so keep it as a leaf.
        if (groups.size <= 1) {
            continue;
        }
        bursts += 1;
        maxDepth = Math.max(maxDepth, node.depth + 1);
        for (const [key, values] of groups) {
            const child: TrieNode = { children: new Map(), bucket: values, depth: node.depth + 1 };
            node.children.set(key, child);
            queue.push(child);
        }
        node.bucket = [];
    }

    const sorted: string[] = [];
    const visit = (node: TrieNode): void => {
        if (node.children.size === 0) {
            sorted.push(...[...node.bucket].sort());
            return;
        }
        for (const key of [...node.children.keys()].sort()) {
            visit(node.children.get(key) as TrieNode);
        }
        if (node.bucket.length > 0) {
            sorted.push(...[...node.bucket].sort());
        }
    };
    visit(root);
    return { sorted, bursts, maxDepth };
}

const PALETTE: EntityState[] = ["active", "comparing", "highlight", "visited", "pivot", "path"];

function makeCells(
    strings: string[],
    states: Map<number, EntityState>,
    cols: number,
): VisualEntity[] {
    return strings.map((str, index) => ({
        id: `str-${index}`,
        type: "cell" as const,
        label: str,
        value: str,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, row: Math.floor(index / cols), col: index % cols, str },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { strings?: string[]; capacity?: number } | null) ?? {};
    const strings = task.strings ?? [
        "cat", "car", "dog", "cab", "bat", "dot", "can", "dove",
        "bad", "cow", "bar", "data", "dock", "bus",
    ];
    const capacity = typeof task.capacity === "number" && task.capacity >= 1 ? task.capacity : 3;

    const cols = Math.min(4, Math.max(1, strings.length));
    const rows = Math.max(1, Math.ceil(strings.length / cols));
    let step = 0;

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, MetaValue> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(strings, states, cols),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { rows, cols, count: strings.length, capacity, ...extra },
    });

    yield frame(new Map(), `Burst Sort on ${strings.length} strings with bucket capacity ${capacity}.`, 0);
    step += 1;

    if (strings.length === 0) {
        yield frame(new Map(), "No strings to sort; the trie is empty.", 6, { sorted: [] });
        return;
    }

    const result = burstSort(strings, capacity);

    const maxStages = Math.min(result.maxDepth, 5);
    for (let depth = 0; depth < maxStages; depth += 1) {
        const bucketOf = new Map<string, number>();
        const states = new Map<number, EntityState>();
        strings.forEach((str, index) => {
            const key = depth < str.length ? (str[depth] as string) : "\u0000";
            if (!bucketOf.has(key)) {
                bucketOf.set(key, bucketOf.size);
            }
            states.set(index, PALETTE[(bucketOf.get(key) as number) % PALETTE.length] as EntityState);
        });
        yield frame(
            states,
            `Level ${depth}: ${bucketOf.size} bucket(s) keyed by character position ${depth}.`,
            2,
            { level: depth, buckets: bucketOf.size },
        );
        step += 1;
    }

    yield frame(
        new Map(),
        `No bucket exceeds capacity ${capacity} after ${result.bursts} burst(s); sorting leaf buckets.`,
        3,
        { bursts: result.bursts },
    );
    step += 1;

    const sortedStates = new Map<number, EntityState>();
    strings.forEach((_str, index) => sortedStates.set(index, "sorted"));
    yield frame(
        sortedStates,
        `Done: ${result.sorted.length} strings sorted in trie order.`,
        6,
        { bursts: result.bursts, sorted: result.sorted },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Burst sort keeps strings in buckets and only looks at the next character when a bucket grows too large. A big bucket is replaced by smaller buckets keyed by that character position, so expensive work happens only where many strings share a prefix. When every bucket is small, sorting each one directly and reading them in order gives the final sorted list.",
        invariants: [
            "All strings in a bucket share the same prefix of length equal to the bucket's depth.",
            "The children of a burst node partition its strings by the next character.",
            "Visiting trie children in character order visits strings in lexicographic order.",
        ],
        correctness:
            "A burst replaces a bucket by child buckets grouped on the next character, and strings with a shorter length fall into a terminator group that sorts first. By induction every bucket at depth d contains exactly the strings sharing a prefix of length d, and leaves hold at most capacity strings. Sorting each leaf and visiting children in increasing character order therefore emits all strings in lexicographic order.",
        complexityRationale:
            "Each burst inspects the characters of every string in the overflowing bucket, and a string is re-inspected once per prefix character before reaching a small bucket, giving time linear in total characters plus the number of bursts. The trie stores each string's characters once, so space is linear in total characters.",
        uses: [
            "Sorting large string collections and text indexes efficiently",
            "Building suffix and inverted indexes in memory-constrained settings",
            "A cache-aware alternative to comparison sorts for string keys",
        ],
        references: [
            "Sinha, Ringstad, Srinivasan and Walsh, Burstsort: caching-efficient string sorting, 2003",
            "Wikipedia, Burst sort, overview article",
        ],
        workedExample:
            'With capacity 2 and strings ["cat", "car", "dog", "cab"], the root bursts on the first character into c and d groups. The c group still overflows and bursts on the second and then third characters into single-string leaves. Reading leaves in character order gives ["cab", "car", "cat", "dog"].',
    },
    id: "burst-sort",
    name: "Burst Sort",
    category: "sorting",
    complexity: { time: "O(total characters + bursts)", space: "O(total characters)" },
    defaultInput: {
        strings: [
            "cat", "car", "dog", "cab", "bat", "dot", "can", "dove",
            "bad", "cow", "bar", "data", "dock", "bus",
        ],
        capacity: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "place all strings in a root bucket at depth zero",
        "for each bucket larger than the capacity",
        "burst it into child buckets keyed by the next character",
        "repeat bursting until every bucket fits the capacity",
        "sort the strings inside each small leaf bucket",
        "traverse the trie in character order to emit sorted strings",
        "done: report the sorted string list",
    ],
};

export default module;
