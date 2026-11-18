/**
 * log-structured-merge-read-path.ts - LSM Tree Read Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An LSM tree serves reads by checking the newest storage first and stopping at
 * the first copy of a key. It probes the in-memory memtable, then sorted string
 * tables level by level from level zero downward. Each table carries a key range
 * and a Bloom filter, which cheaply rule out tables that cannot contain the key
 * and avoid most disk reads. A tombstone in the newest copy means the key was
 * deleted and ends the search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t) for t tables checked by range and Bloom filter
 *   Space: O(t) for the component list and displayed cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per storage component (memtable and each table).
 *   - A hit is green, a checked miss is visited, a skipped table stays idle.
 *   - meta carries the probe path, skips, and the final value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TableInput {
    id: string;
    minKey: string;
    maxKey: string;
    keys?: Record<string, number | string>;
}

/** FNV-1a style hash. */
function hashOne(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** djb2 style hash. */
function hashTwo(value: string): number {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
        hash = (Math.imul(hash, 33) ^ value.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
}

const BLOOM_BITS = 64;

/** Insert a key into a small Bloom filter bit array. */
function bloomInsert(bits: boolean[], key: string): void {
    const h1 = hashOne(key);
    const h2 = hashTwo(key);
    const positions = [h1 % BLOOM_BITS, h2 % BLOOM_BITS, (h1 >>> 16) ^ (h2 % BLOOM_BITS)];
    for (const position of positions) {
        bits[position % BLOOM_BITS] = true;
    }
}

/** Query a Bloom filter; false means definitely absent. */
function bloomMightContain(bits: boolean[], key: string): boolean {
    const h1 = hashOne(key);
    const h2 = hashTwo(key);
    const positions = [h1 % BLOOM_BITS, h2 % BLOOM_BITS, (h1 >>> 16) ^ (h2 % BLOOM_BITS)];
    return positions.every((position) => bits[position % BLOOM_BITS] === true);
}

/** Build the component cells. */
function makeCells(
    labels: string[],
    states: EntityState[],
    current: number,
    done: boolean,
): VisualEntity[] {
    return labels.map((label, index) => {
        let state: EntityState = states[index] ?? "idle";
        if (done && state === "visited") {
            state = "visited";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label,
            value: label,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, component: label },
        };
    });
}

/** The LSM read-path generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        key?: string;
        memtable?: Record<string, number | string>;
        levels?: TableInput[][];
    } | null) ?? {};
    const key = typeof task.key === "string" ? task.key : "k47";
    const memtable = task.memtable && typeof task.memtable === "object" ? task.memtable : { b: "2" };
    const levels = Array.isArray(task.levels) && task.levels.length > 0
        ? task.levels
        : [
            [{ id: "s0", minKey: "a", maxKey: "m", keys: { a: "1", c: "3" } }],
            [{ id: "s1", minKey: "k", maxKey: "z", keys: { k47: "47", z: "26" } }],
        ];

    const labels = [`memtable(${Object.keys(memtable).length})`];
    for (let level = 0; level < levels.length; level += 1) {
        for (const table of levels[level] ?? []) {
            labels.push(`L${level}:${table.id}`);
        }
    }
    const states: EntityState[] = new Array(labels.length).fill("idle");
    const path: string[] = [];
    const skippedByBloom: string[] = [];
    const skippedByRange: string[] = [];
    const tablesWithKey: string[] = [];

    const buildMeta = (
        phase: string,
        found: boolean,
        value: number | string,
        deleted: boolean,
        current: number,
    ) => ({
        phase,
        rows: 1,
        cols: labels.length,
        key,
        labels: [...labels],
        componentStates: states.map((state) => String(state)),
        path: [...path],
        skippedByBloom: [...skippedByBloom],
        skippedByRange: [...skippedByRange],
        tablesWithKey: [...tablesWithKey],
        probes: path.length,
        found,
        value,
        deleted,
        currentComponent: current >= 0 ? (labels[current] ?? "") : "",
    });

    yield {
        stepNumber: 0,
        entities: makeCells(labels, states, -1, false),
        edges: [],
        description: `Read key '${key}' through the memtable and ${levels.length} level(s) of sorted tables.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: buildMeta("setup", false, "", false, -1),
    };
    let step = 1;

    if (Object.prototype.hasOwnProperty.call(memtable, key)) {
        states[0] = "sorted";
        path.push("memtable");
        const value = memtable[key] ?? "";
        const deleted = value === "TOMBSTONE";
        yield {
            stepNumber: step,
            entities: makeCells(labels, states, 0, false),
            edges: [],
            description: `Found '${key}' in the memtable with value ${deleted ? "TOMBSTONE" : String(value)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: buildMeta("hit", true, value, deleted, 0),
        };
        yield {
            stepNumber: step + 1,
            entities: makeCells(labels, states, -1, true),
            edges: [],
            description: `Read complete: ${deleted ? "key is deleted" : `value is ${String(value)}`}; ${path.length} probe(s).`,
            codeLineNumber: 6,
            layout: "grid",
            meta: buildMeta("done", true, value, deleted, -1),
        };
        return;
    }
    states[0] = "visited";
    path.push("memtable");
    yield {
        stepNumber: step,
        entities: makeCells(labels, states, 0, false),
        edges: [],
        description: `Key '${key}' is not in the memtable; continue to the sorted tables.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: buildMeta("miss", false, "", false, 0),
    };
    step += 1;

    let componentIndex = 1;
    for (let level = 0; level < levels.length; level += 1) {
        for (const table of levels[level] ?? []) {
            const label = `L${level}:${table.id}`;
            const tableKeys = table.keys ?? {};
            if (Object.prototype.hasOwnProperty.call(tableKeys, key)) {
                tablesWithKey.push(label);
            }
            const inRange = key >= table.minKey && key <= table.maxKey;
            if (!inRange) {
                states[componentIndex] = "unvisited";
                skippedByRange.push(label);
                yield {
                    stepNumber: step,
                    entities: makeCells(labels, states, componentIndex, false),
                    edges: [],
                    description: `${label}: key outside range [${table.minKey}, ${table.maxKey}]; skip without probing.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: buildMeta("range-skip", false, "", false, componentIndex),
                };
                componentIndex += 1;
                step += 1;
                continue;
            }

            const bits = new Array<boolean>(BLOOM_BITS).fill(false);
            for (const storedKey of Object.keys(tableKeys)) {
                bloomInsert(bits, storedKey);
            }
            if (!bloomMightContain(bits, key)) {
                states[componentIndex] = "idle";
                skippedByBloom.push(label);
                yield {
                    stepNumber: step,
                    entities: makeCells(labels, states, componentIndex, false),
                    edges: [],
                    description: `${label}: Bloom filter says the key is absent; skip the table read.`,
                    codeLineNumber: 3,
                    layout: "grid",
                    meta: buildMeta("bloom-skip", false, "", false, componentIndex),
                };
                componentIndex += 1;
                step += 1;
                continue;
            }

            path.push(label);
            if (Object.prototype.hasOwnProperty.call(tableKeys, key)) {
                const value = tableKeys[key] ?? "";
                const deleted = value === "TOMBSTONE";
                states[componentIndex] = "sorted";
                yield {
                    stepNumber: step,
                    entities: makeCells(labels, states, componentIndex, false),
                    edges: [],
                    description: `Found '${key}' in ${label} with value ${deleted ? "TOMBSTONE" : String(value)}.`,
                    codeLineNumber: 4,
                    layout: "grid",
                    meta: buildMeta("hit", true, value, deleted, componentIndex),
                };
                step += 1;
                yield {
                    stepNumber: step,
                    entities: makeCells(labels, states, -1, true),
                    edges: [],
                    description: `Read complete: ${deleted ? "key is deleted" : `value is ${String(value)}`}; ${path.length} probe(s).`,
                    codeLineNumber: 6,
                    layout: "grid",
                    meta: buildMeta("done", true, value, deleted, -1),
                };
                return;
            }

            states[componentIndex] = "visited";
            yield {
                stepNumber: step,
                entities: makeCells(labels, states, componentIndex, false),
                edges: [],
                description: `${label}: Bloom filter said maybe, but the key is not present; continue to the next table.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: buildMeta("miss", false, "", false, componentIndex),
            };
            componentIndex += 1;
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(labels, states, -1, true),
        edges: [],
        description: `Read complete: key '${key}' was not found in any component after ${path.length} probe(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: buildMeta("done", false, "", false, -1),
    };
}

/** The LSM read-path module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Newest data wins in an LSM tree, so a read starts in the memtable and walks tables from newest level to oldest, stopping at the first answer. Range metadata and Bloom filters act as bouncers: if a table's keys cannot include the target, skip the expensive read. A deletion marker is itself an answer and stops the search just like a value.",
        invariants: [
            "Components are examined from newest to oldest.",
            "A Bloom filter never rejects a key that is actually present.",
            "The first matching copy of a key ends the read, value or tombstone.",
        ],
        correctness:
            "Writes in an LSM tree are applied to the memtable in arrival order and flushed to successively older tables, so for any key the newest copy holds the current state. Scanning components in newest-to-oldest order and returning at the first match therefore returns the current state. A range check is sound because keys are sorted within a table. A standard Bloom filter has no false negatives, so skipping a table it rejects cannot hide a present key. A tombstone is a deliberate newest copy meaning deleted, so returning it as a deletion is correct.",
        complexityRationale:
            "Each component needs one range check, a constant-time Bloom query, and at most one key lookup, so checking t components takes O(t) time. The displayed component list and per-step cells use O(t) space.",
        uses: [
            "Point lookups in LSM-based key-value stores",
            "Explaining Bloom filters and read amplification",
            "Tuning leveled compaction for read-heavy workloads",
        ],
        references: [
            "O'Neil et al., The Log-Structured Merge-Tree, 1996",
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, 1970",
        ],
        workedExample:
            "Looking up k47 with a memtable containing only b skips a level-zero table whose range ends at m, then probes a level-one table whose Bloom filter passes and finds k47 with value 47. If the memtable instead held a tombstone for k47, the read would stop there and report the key deleted.",
    },
    id: "log-structured-merge-read-path",
    name: "Log-Structured Merge Read Path",
    category: "production-systems",
    complexity: { time: "O(t)", space: "O(t)" },
    defaultInput: {
        key: "k47",
        memtable: { b: "2" },
        levels: [
            [{ id: "s0", minKey: "a", maxKey: "m", keys: { a: "1", c: "3" } }],
            [{ id: "s1", minKey: "k", maxKey: "z", keys: { k47: "47", z: "26" } }],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "check the memtable for the key",
        "for each level and table from newest to oldest",
        "skip a table when the key is outside its range",
        "skip a table when its Bloom filter says absent",
        "otherwise probe the table for the key",
        "return the first value or tombstone found",
        "done: report the value or that the key is absent",
    ],
};

export default module;
