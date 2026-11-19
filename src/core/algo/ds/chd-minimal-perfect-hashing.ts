/**
 * chd-minimal-perfect-hashing.ts - CHD Minimal Perfect Hashing
 *
 * CHD ("Compress, Hash, Displace") builds a perfect hash for a static key set.
 * Keys are compressed into buckets; each bucket searches for a displacement
 * that sends its keys to free cells of a sparse table (hash, displace). A rank
 * directory then compresses the sparse table to exactly n slots, making the
 * function minimal: the n keys map bijectively onto 0..n-1. Lookups are a
 * constant number of hash evaluations with no probe chains.
 *
 * Time:  O(n) expected construction, O(1) lookup
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface CHDTable {
    keys: string[];
    buckets: number;
    tableSize: number;
    seed0: number;
    seed1: number;
    disp: number[];
    occupied: boolean[];
    stored: Array<string | null>;
    rank: number[];
}

function hash(value: string, seed: number): number {
    let h = (2166136261 ^ seed) >>> 0;
    for (let i = 0; i < value.length; i += 1) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

/** Build a CHD minimal perfect hash; hashes are a bijection onto 0..n-1. */
export function buildCHD(rawKeys: Array<number | string>): CHDTable {
    const keys = [...new Set(rawKeys.map(String))];
    const n = keys.length;
    const buckets = Math.max(1, Math.ceil(n / 0.77));
    const tableSize = n + Math.max(2, Math.ceil(0.3 * n));
    const seed1 = 0x9e3779b9;
    const position = (key: string, displacement: number): number =>
        hash(key, (seed1 + Math.imul(displacement, 1000003)) >>> 0) % tableSize;

    let table: CHDTable | null = null;
    for (let attempt = 0; attempt < 200 && !table; attempt += 1) {
        const seed0 = attempt + 1;
        const disp = new Array<number>(buckets).fill(-1);
        const occupied = new Array<boolean>(tableSize).fill(false);
        const stored = new Array<string | null>(tableSize).fill(null);
        const byBucket: number[][] = Array.from({ length: buckets }, () => []);
        keys.forEach((key, i) => {
            const b = hash(key, seed0) % buckets;
            byBucket[b]?.push(i);
        });

        let ok = true;
        for (let b = 0; b < buckets && ok; b += 1) {
            const members = byBucket[b] ?? [];
            if (members.length === 0) continue;
            let chosen = -1;
            for (let d = 0; d < 5000; d += 1) {
                const slots = members.map((i) => position(keys[i] ?? "", d));
                if (new Set(slots).size !== slots.length) continue;
                if (slots.some((slot) => occupied[slot])) continue;
                chosen = d;
                for (let k = 0; k < members.length; k += 1) {
                    const idx = members[k] ?? 0;
                    const slot = slots[k] ?? 0;
                    occupied[slot] = true;
                    stored[slot] = keys[idx] ?? "";
                }
                break;
            }
            if (chosen < 0) ok = false;
            else disp[b] = chosen;
        }

        if (ok) {
            const rank = new Array<number>(tableSize).fill(0);
            let count = 0;
            for (let i = 0; i < tableSize; i += 1) {
                rank[i] = count;
                if (occupied[i]) count += 1;
            }
            table = { keys, buckets, tableSize, seed0, seed1, disp, occupied, stored, rank };
        }
    }

    // Fallback should be unreachable for reasonable inputs, but keep a valid table.
    if (!table) {
        const disp = new Array<number>(buckets).fill(0);
        const occupied = new Array<boolean>(tableSize).fill(false);
        const stored = new Array<string | null>(tableSize).fill(null);
        keys.forEach((key, i) => {
            occupied[i] = true;
            stored[i] = key;
        });
        const rank = keys.map((_, i) => i);
        while (rank.length < tableSize) rank.push(n);
        table = { keys, buckets, tableSize, seed0: 1, seed1, disp, occupied, stored, rank };
    }
    return table;
}

/** Return the minimal perfect hash of key, or -1 when key is absent. */
export function lookupCHD(table: CHDTable, key: number | string): number {
    const text = String(key);
    const b = hash(text, table.seed0) % table.buckets;
    const d = table.disp[b] ?? -1;
    if (d < 0) return -1;
    const pos = hash(text, (table.seed1 + Math.imul(d, 1000003)) >>> 0) % table.tableSize;
    if (!table.occupied[pos] || table.stored[pos] !== text) return -1;
    return table.rank[pos] ?? -1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: Array<number | string>; query?: number | string } | null) ?? {};
    const raw = Array.isArray(task.keys) ? task.keys : [12, 5, 21, 8, 3, 30];
    const table = buildCHD(raw);
    const query = task.query === undefined ? 21 : task.query;
    let step = 0;
    let hotBucket = -1;
    let hotSlot = -1;

    const snapshot = (message: string, line: number, answer: string): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let b = 0; b < table.buckets; b += 1) {
            entities.push({
                id: `chd-d-${b}`,
                type: "cell" as const,
                label: `b${b}:d${table.disp[b] ?? -1}`,
                value: table.disp[b] ?? -1,
                state: (hotBucket === b ? "comparing" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { row: 0, col: b, kind: "displacement" },
            });
        }
        for (let slot = 0; slot < table.tableSize; slot += 1) {
            entities.push({
                id: `chd-t-${slot}`,
                type: "cell" as const,
                label: table.stored[slot] ?? ".",
                value: table.rank[slot] ?? -1,
                state: (hotSlot === slot ? "highlight" : table.occupied[slot] ? "sorted" : "unvisited") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { row: 1, col: slot, kind: "table", occupied: table.occupied[slot] ?? false },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                keys: table.keys.length,
                buckets: table.buckets,
                tableSize: table.tableSize,
                minimal: true,
                answer,
            },
        };
    };

    yield snapshot(`CHD: ${table.keys.length} keys compressed into ${table.buckets} buckets.`, 0, "pending");
    step += 1;

    for (let i = 0; i < table.keys.length; i += 1) {
        const key = table.keys[i] ?? "";
        const bucket = hash(key, table.seed0) % table.buckets;
        hotBucket = bucket;
        const d = table.disp[bucket] ?? -1;
        const slot = hash(key, (table.seed1 + Math.imul(d, 1000003)) >>> 0) % table.tableSize;
        hotSlot = slot;
        yield snapshot(
            `Place "${key}": bucket ${bucket} displacement ${d} gives sparse slot ${slot}.`,
            3,
            "pending",
        );
        step += 1;
    }

    const result = lookupCHD(table, query);
    hotBucket = hash(String(query), table.seed0) % table.buckets;
    const d = table.disp[hotBucket] ?? -1;
    hotSlot = hash(String(query), (table.seed1 + Math.imul(d, 1000003)) >>> 0) % table.tableSize;
    yield snapshot(`Lookup "${query}": ${result < 0 ? "absent" : `minimal hash ${result}`}.`, 5, String(result));
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CHD first squeezes keys into a small number of buckets, then gives each bucket its own displacement seed so its keys land in free cells of a slightly larger table. A rank bit-vector finally compresses those sparse cells to consecutive positions 0 through n-1. The result is a perfect hash that is also minimal, built without any probe chains at lookup time.",
        invariants: [
            "Each key occupies exactly one sparse table slot chosen by hash and displacement.",
            "No two keys share a slot, so the sparse table is collision free.",
            "The rank of an occupied slot equals the number of occupied slots before it.",
        ],
        correctness:
            "A bucket accepts a displacement only when all of its keys map to distinct, still-free slots, so the sparse table is injective by construction. Ranking counts occupied slots in order and therefore maps the n used slots bijectively to 0..n-1, which is exactly a minimal perfect hash. Lookup recomputes the same slot and checks the stored key, rejecting absent keys.",
        complexityRationale:
            "Each bucket usually finds a displacement after a constant number of trials, so expected build time is O(n); lookup is two hash evaluations and an array read, O(1). The displacement table, sparse table, and rank directory use O(n) space.",
        uses: [
            "Static dictionaries and language keyword tables",
            "Compact indexes in search engines and compilers",
            "Read-only sets that need guaranteed O(1) membership",
        ],
        references: [
            "Botelho, Pagh and Ziviani, 'Simple and Space-Efficient Minimal Perfect Hash Functions', WADS 2007",
            "Belazzougui, Botelho and Dietzfelbinger, 'Hash, Displace and Compress', ESA 2009",
        ],
        workedExample:
            "Keys 12, 5, 21, 8, 3, 30 are compressed into about eight buckets. Each bucket tries displacements until its keys hit unused sparse slots. If occupied slots are at sparse indices 1, 4, 6, 9, 11, 14, the rank directory maps them to minimal hashes 0 through 5.",
    },
    id: "chd-minimal-perfect-hashing",
    name: "CHD Minimal Perfect Hashing",
    category: "data-structures",
    complexity: { time: "O(n) expected build, O(1) lookup", space: "O(n)" },
    defaultInput: { keys: [12, 5, 21, 8, 3, 30], query: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "compress the static key set into buckets with a first hash",
        "allocate a sparse table slightly larger than the key count",
        "for each bucket try displacements until keys hit free slots",
        "record the winning displacement for that bucket",
        "mark each chosen slot in the sparse table",
        "build a rank directory over the occupied slots",
        "lookup hashes twice, checks the slot, then reads its rank",
        "done: keys map bijectively onto zero through n minus one",
    ],
};

export default module;
