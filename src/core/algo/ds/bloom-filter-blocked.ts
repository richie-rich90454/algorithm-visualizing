/**
 * bloom-filter-blocked.ts - Blocked Bloom Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A blocked bloom filter divides its bit array into small blocks, ideally one
 * cache line each. An item selects a single block with one hash, then sets k
 * bits inside that block using a second hash. A query touches only one block,
 * which gives far better cache behavior than a conventional filter whose k
 * probes scatter across the whole array. Like any bloom filter it can report
 * false positives but never false negatives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) per insert or query - one hash plus k bit probes
 *   Space: O(b * w) bits for b blocks of w bits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell is one bit, grouped into rows that represent blocks.
 *   - The block chosen by an item is YELLOW (comparing) while probing.
 *   - Bits that are set are GREEN (sorted); a verified query is PATH.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = {
    items?: string[];
    queries?: string[];
    numBlocks?: number;
    bitsPerBlock?: number;
    k?: number;
};

/** Deterministic 32-bit FNV-1a hash so the visualization is reproducible. */
function hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function makeCells(
    bits: number[][],
    activeBlock: number,
    activeBits: Set<number>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let b = 0; b < bits.length; b += 1) {
        const row = bits[b] ?? [];
        for (let i = 0; i < row.length; i += 1) {
            const key = `${b}:${i}`;
            let state: EntityState = row[i] === 1 ? "sorted" : "idle";
            if (b === activeBlock) {
                state = "comparing";
            }
            if (activeBits.has(i) && b === activeBlock) {
                state = "path";
            }
            state = states.get(key) ?? state;
            entities.push({
                id: `cell-${b}-${i}`,
                type: "cell" as const,
                label: String(row[i] ?? 0),
                value: row[i] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: b, col: i, bit: row[i] ?? 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const items = (task.items ?? ["apple", "banana", "cherry", "date", "fig"]).filter(
        (s): s is string => typeof s === "string",
    );
    const queries = (task.queries ?? ["apple", "banana", "date", "kiwi", "grape"]).filter(
        (s): s is string => typeof s === "string",
    );
    const numBlocks = Math.max(1, Math.min(8, Math.floor(task.numBlocks ?? 4)));
    const bitsPerBlock = Math.max(4, Math.min(32, Math.floor(task.bitsPerBlock ?? 16)));
    const k = Math.max(1, Math.min(6, Math.floor(task.k ?? 3)));
    const bits: number[][] = Array.from({ length: numBlocks }, () => new Array<number>(bitsPerBlock).fill(0));

    const probePositions = (item: string): { block: number; positions: number[] } => {
        const h1 = hash(item);
        const block = h1 % numBlocks;
        const h2 = hash(`${item}|salt`);
        const step = (h2 % (bitsPerBlock - 1)) + 1;
        const positions: number[] = [];
        for (let j = 0; j < k; j += 1) {
            positions.push((h2 + j * step) % bitsPerBlock);
        }
        return { block, positions };
    };

    let step = 0;
    const frame = (
        description: string,
        codeLine: number,
        block: number,
        activeBits: Set<number>,
        meta: VisualFrame["meta"],
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(bits, block, activeBits),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid",
        meta: { rows: numBlocks, cols: bitsPerBlock, k, ...meta },
    });

    yield frame(
        `Initializing a blocked bloom filter with ${numBlocks} block(s) of ${bitsPerBlock} bit(s).`,
        0,
        -1,
        new Set(),
        { bits: bits.flat(), itemCount: items.length },
    );
    step += 1;

    for (const item of items) {
        const { block, positions } = probePositions(item);
        yield frame(
            `Inserting "${item}": hash selects block ${block}; probing bits [${positions.join(", ")}].`,
            2,
            block,
            new Set(positions),
            { item, block, positions: [...positions], phase: "insert" },
        );
        step += 1;
        for (const bit of positions) {
            const row = bits[block] as number[];
            row[bit] = 1;
        }
        yield frame(
            `Set the probed bits for "${item}" in block ${block}.`,
            3,
            block,
            new Set(positions),
            { item, block, positions: [...positions], phase: "set" },
        );
        step += 1;
    }

    const results: Array<{ item: string; present: boolean }> = [];
    for (const item of queries) {
        const { block, positions } = probePositions(item);
        const row = bits[block] as number[];
        const present = positions.every((bit) => row[bit] === 1);
        results.push({ item, present });
        yield frame(
            `Query "${item}": block ${block} bits [${positions.join(", ")}] are ${present ? "all set" : "not all set"}.`,
            5,
            block,
            new Set(positions),
            { item, block, positions: [...positions], present, phase: "query" },
        );
        step += 1;
    }

    yield frame(
        `Done: ${results.filter((r) => r.present).length} of ${results.length} queries reported present.`,
        7,
        -1,
        new Set(),
        { bits: bits.flat(), queries: results.map((r) => r.item), results: results.map((r) => (r.present ? 1 : 0)), itemCount: items.length },
    );
}

/** The Blocked Bloom Filter module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal bloom filter sets k scattered bits, which means k cache misses per operation. A blocked filter picks one cache-line-sized block first and keeps all k probes inside it, so only one cache line is touched. The tradeoff is a slightly higher false-positive rate for the same total number of bits.",
        invariants: [
            "An item's block and bit positions are deterministic functions of its hashes.",
            "Every insert sets only bits inside the single selected block.",
            "If all k bits for an item are set, a query for that item never returns false.",
        ],
        correctness:
            "Insertion sets exactly the bits that the query procedure later checks, using the same deterministic hash computations. Therefore an inserted item always finds all k bits set, which rules out false negatives. A query for an item never inserted can still find all bits set accidentally, which is the expected false-positive behavior of bloom filters.",
        complexityRationale:
            "Each operation computes two hashes and inspects or sets k bits in one block, so time is O(k) independent of the number of stored items. The filter stores b blocks of w bits, or O(b * w) bits of space.",
        uses: [
            "Fast membership tests in databases and key-value stores",
            "Avoiding disk reads for keys that are definitely absent",
            "Network routers and caches where cache-line locality matters",
        ],
        references: [
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, 1970",
            "Putze, Sanders and Singler, Cache-, Hash- and Space-Efficient Bloom Filters, 2007",
        ],
        workedExample:
            'With four blocks of sixteen bits and three probes, inserting "apple" selects one block by its first hash and sets three bit positions from its second hash. Querying "apple" checks those same three bits and always finds them set.',
    },
    id: "bloom-filter-blocked",
    name: "Blocked Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k)", space: "O(b * w)" },
    defaultInput: {
        items: ["apple", "banana", "cherry", "date", "fig"],
        queries: ["apple", "banana", "date", "kiwi", "grape"],
        numBlocks: 4,
        bitsPerBlock: 16,
        k: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate b blocks of w zeroed bits",
        "for each item to insert",
        "hash the item once to choose a single block",
        "hash the item again to choose k bit positions in that block",
        "set those k bits to one",
        "for each query item",
        "recompute the block and the k bit positions",
        "report present only when every probed bit is one",
        "done: return the filter bits and query results",
    ],
};

export default module;
