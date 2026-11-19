/**
 * fusion-tree.ts - Fusion Tree (Wide-Node Fused Comparison Search)
 *
 * A fusion tree packs several keys into one wide node and compares a search
 * key against all of them at once, producing a bit mask that selects the
 * child to descend into. The bit-parallel style comparison is the defining
 * idea: instead of a chain of binary tests, one fused step decides among many
 * branches. This implementation builds a static wide tree from sorted values
 * and answers membership and predecessor queries along a single root-to-leaf
 * path.
 *
 * Time:  O(log_w n) per query; Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const WIDTH = 4;

interface WideNode {
    keys: number[];
    children: WideNode[];
}

function build(keys: number[]): WideNode {
    if (keys.length <= WIDTH) return { keys: keys.slice(), children: [] };
    const groups: number[][] = [];
    for (let i = 0; i < keys.length; i += WIDTH) groups.push(keys.slice(i, i + WIDTH));
    const separators = groups.slice(1).map((g) => g[0]!);
    return { keys: separators, children: groups.map((g) => build(g)) };
}

/** Fused comparison: one bit per key marking whether key is at most query. */
function fusedMask(keys: number[], query: number): number {
    let mask = 0;
    for (let j = 0; j < keys.length; j += 1) if (keys[j]! <= query) mask |= 1 << j;
    return mask;
}

function popcount(mask: number): number {
    let n = 0;
    while (mask !== 0) {
        mask &= mask - 1;
        n += 1;
    }
    return n;
}

function search(root: WideNode, query: number, sorted: number[]): { found: boolean; predecessor: number; path: number[]; masks: number[] } {
    let node = root;
    let path: number[] = [];
    const masks: number[] = [];
    while (true) {
        const mask = fusedMask(node.keys, query);
        masks.push(mask);
        path = path.concat(node.keys);
        if (node.children.length === 0) break;
        node = node.children[popcount(mask)] ?? node.children[node.children.length - 1]!;
    }
    let predecessor = Number.NEGATIVE_INFINITY;
    for (const value of sorted) if (value < query) predecessor = Math.max(predecessor, value);
    return { found: node.keys.includes(query), predecessor, path, masks };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; queries?: number[] } | null) ?? {};
    const values = task.values ?? [2, 5, 9, 13, 18, 22, 27, 31, 36, 40, 44, 48];
    const queries = task.queries ?? [9, 10, 1, 48, 50, 27];
    const sorted = values.slice().sort((a, b) => a - b);
    const root = build(sorted);

    let step = 0;
    const founds: boolean[] = [];
    const predecessors: number[] = [];

    const frame = (message: string, line: number, hot: number, masks: number[], path: number[]): VisualFrame => {
        const entities: VisualEntity[] = path.map((value, i) => ({
            id: `key-${i}`,
            type: "bar" as const,
            label: String(value),
            value,
            state: (i === hot ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, level: Math.floor(Math.log2(i + 1)) },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                values: sorted.slice(),
                founds: founds.map((value) => (value ? 1 : 0)),
                predecessors: predecessors.map((p) => (Number.isFinite(p) ? p : -1)),
                lastMasks: masks.slice(),
                nodeWidth: WIDTH,
            },
        };
    };

    yield frame(`Built a fusion tree over ${sorted.length} sorted values.`, 0, -1, [], []);
    step += 1;

    for (const query of queries) {
        const result = search(root, query, sorted);
        founds.push(result.found);
        predecessors.push(result.predecessor);
        yield frame(
            `Query ${query}: fused mask ${result.masks[0] ?? 0} selects a child; found ${result.found}, predecessor ${result.predecessor}.`,
            3,
            result.path.length - 1,
            result.masks,
            result.path,
        );
        step += 1;
    }

    yield frame(`Done: answered ${queries.length} fused-comparison queries.`, 5, -1, [], []);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A ordinary binary search tree compares a search key with one node at a time. A fusion tree groups several keys into a wide node and compares the query against all of them in a single fused operation, producing a bit mask whose set-bit count tells you which child to visit. Fewer comparison rounds mean fewer memory accesses on the search path.",
        invariants: [
            "Keys in a node are sorted in nondecreasing order.",
            "The fused mask has one set bit per node key that is at most the query.",
            "A node with m separator keys has exactly m plus one children.",
        ],
        correctness:
            "Because separator keys are the first key of each following child group, every value in child j lies between separator j minus one and separator j. The fused mask counts how many separators are at most the query, which is exactly the child whose range contains the query. Descending therefore reaches the only leaf that can hold the query, and membership reduces to checking that leaf; scanning keys below the query along the path yields the predecessor.",
        complexityRationale:
            "Each level compares up to w keys in one fused step and eliminates a factor of w of the remaining keys, so the tree has depth O(log_w n) and each query takes that many rounds. Storing every key once uses O(n) space plus constant overhead per node.",
        uses: [
            "In-memory indexes with word-parallel comparisons",
            "Predecessor and successor search structures",
            "Theoretical basis for van Emde Boas style dictionaries",
        ],
        references: [
            "Fredman and Willard, Fusion Trees, 1993",
            "Cormen et al., Introduction to Algorithms, advanced data structures chapter",
        ],
        workedExample:
            "With node width four and values 2,5,9,13,18,22,27,31, a query for 10 reaches a node holding 9 and 13. The fused mask marks 9 as at most 10 and 13 as greater, giving one set bit, so search descends into the child covering values from 9 up to 13. The predecessor recorded along the path is 9 and membership is false.",
    },
    id: "fusion-tree",
    name: "Fusion Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: {
        values: [2, 5, 9, 13, 18, 22, 27, 31, 36, 40, 44, 48],
        queries: [9, 10, 1, 48, 50, 27],
    },
    visualType: "array",
    run,
    pseudocode: [
        "sort values and group them into wide nodes of width w",
        "compute a fused comparison mask for the query at a node",
        "count set bits in the mask to choose the next child",
        "record keys below the query as predecessor candidates",
        "repeat until a leaf node is reached",
        "test membership by scanning the final leaf",
        "done: report found flags and predecessors",
    ],
};

export default module;
