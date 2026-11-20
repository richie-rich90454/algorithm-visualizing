/**
 * maglev-hashing.ts - Maglev Consistent Hashing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Maglev builds a fixed-size lookup table that spreads traffic across backends
 * while keeping disruption low when the backend set changes. Each backend gets
 * an offset and a skip derived from two independent hashes; because the table
 * size is prime, repeated skipping visits every slot. Backends take the first
 * free slot from their own probe sequence, so every backend occupies a nearly
 * equal share of the table and removing a backend disrupts only a bounded
 * fraction of the slots.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(tableSize * backendCount) in the worst case to fill the table
 *   Space: O(tableSize + backendCount)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid cell is one table slot, labeled with its backend.
 *   - A freshly assigned slot is CYAN; established slots are GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A 32-bit hash of a name with a seed, using FNV-style mixing. */
function hashName(name: string, seed: number): number {
    let h = seed >>> 0;
    for (let i = 0; i < name.length; i += 1) {
        h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
}

/** Build the Maglev lookup table and return the backend in each slot. */
function buildTable(backends: string[], size: number): Array<string | null> {
    const table: Array<string | null> = Array<string | null>(size).fill(null);
    if (backends.length === 0) return table;
    const offsets = backends.map((b) => hashName(b, 2166136261) % size);
    const skips = backends.map((b) => (hashName(b, 0x9e3779b9) % (size - 1)) + 1);
    const next = Array<number>(backends.length).fill(0);

    let placed = 0;
    for (let i = 0; i < size && placed < size; i += 1) {
        for (let b = 0; b < backends.length && placed < size; b += 1) {
            let slot = (offsets[b] + next[b] * skips[b]) % size;
            while (table[slot] !== null) {
                next[b] += 1;
                slot = (offsets[b] + next[b] * skips[b]) % size;
            }
            table[slot] = backends[b];
            next[b] += 1;
            placed += 1;
        }
    }
    return table;
}

/** Build one cell per table slot. */
function makeCells(table: Array<string | null>, fresh: Set<number>): VisualEntity[] {
    return table.map((backend, index) => ({
        id: `slot-${index}`,
        type: "cell" as const,
        label: backend ? backend.slice(-1) : "-",
        value: backend ?? "",
        state: (backend ? (fresh.has(index) ? "active" : "sorted") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, backend: backend ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { backends?: string[]; tableSize?: number } | null) ?? {};
    const backends = task.backends ?? ["backend-apple", "backend-banana", "backend-cherry"];
    const size = typeof task.tableSize === "number" && task.tableSize > 2 ? task.tableSize : 13;

    const table = buildTable(backends, size);
    yield {
        stepNumber: 0,
        entities: makeCells(table, new Set()),
        edges: [],
        description: `Building a Maglev table of ${size} slots for ${backends.length} backend(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { tableSize: size, backends: backends.length, rows: 1, cols: size, filled: 0 },
    };

    const fresh = new Set<number>();
    let step = 1;
    const full = buildTable(backends, size);
    for (let index = 0; index < size; index += 1) {
        const backend = full[index];
        if (backend) fresh.add(index);
        const partial: Array<string | null> = Array<string | null>(size).fill(null);
        for (let i = 0; i <= index; i += 1) partial[i] = full[i] ?? null;
        const counts: Record<string, number | string | boolean> = {};
        for (const b of backends) {
            counts[b] = partial.filter((slot) => slot === b).length;
        }
        yield {
            stepNumber: step,
            entities: makeCells(partial, fresh),
            edges: [],
            description: `Placed ${backend ?? "a backend"} into slot ${index} using its probe sequence.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { tableSize: size, backends: backends.length, rows: 1, cols: size, filled: index + 1, ...counts },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(table, new Set()),
        edges: [],
        description: `Table full: ${size} slots distributed across ${backends.length} backend(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { tableSize: size, backends: backends.length, rows: 1, cols: size, filled: size },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Load balancers need a fixed lookup table mapping a hashed request to a backend. Maglev fills that table by giving each backend a private offset and step through the slots, then letting each backend claim the first free slot it probes. Because the table size is prime, the probe visits every slot, and the result is an even spread that barely changes when one backend is added or removed.",
        invariants: [
            "The table size is prime so each skip is coprime with the number of slots.",
            "Every slot is eventually assigned to exactly one backend.",
            "A backend's slot count differs from any other's by at most one.",
            "Removing a backend keeps most surviving assignments in place.",
        ],
        correctness:
            "Two independent hashes give each backend a fixed offset and skip; since the table size is prime and each skip lies between one and size minus one, the probe sequence is a full cycle through the slots. Filling in backend order while taking the first unoccupied slot is a round-robin assignment over a permutation, which bounds the count difference between any two backends to one. When a backend disappears, each survivor keeps its own probe sequence and insertion order, so most assignments stay put; only entries that collided with the removed backend shift to a later probe, keeping disruption to a small fraction of the table.",
        complexityRationale:
            "Each of the size slots may be probed up to backendCount times in the worst case while scanning for a free slot, giving O(size times backendCount) time. The table, offsets, skips, and next counters use O(size plus backendCount) space.",
        uses: [
            "Network load balancing in large-scale Google-style Maglev deployments",
            "Stateless request distribution where consistent mappings reduce cache misses",
            "Choosing a shard for a key with minimal reshuffling on membership changes",
        ],
        references: [
            "Eisenbud et al., Maglev: A Fast and Reliable Software Network Load Balancer, 2016",
            "Karger et al., Consistent Hashing and Random Trees, 1997",
        ],
        workedExample:
            "With three backends and a thirteen-slot table, hashing produces offsets and skips such as offset 4 skip 3 for one backend. That backend probes slots 4, 7, 10, 0, and so on, claiming the first free one. After the table fills, each backend owns four or five slots; removing a backend reassigns roughly a quarter of the table while leaving most surviving entries in place.",
    },
    id: "maglev-hashing",
    name: "Maglev Consistent Hashing",
    category: "production-systems",
    complexity: { time: "O(tableSize * backendCount)", space: "O(tableSize + backendCount)" },
    defaultInput: {
        backends: ["backend-apple", "backend-banana", "backend-cherry"],
        tableSize: 13,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a prime table size and hash each backend twice",
        "set each backend's offset and skip from its hashes",
        "for every slot in the table",
        "let each backend probe its next free slot and claim it",
        "advance that backend's probe counter",
        "repeat until every slot is assigned",
        "done: report the filled lookup table",
    ],
};

export default module;
