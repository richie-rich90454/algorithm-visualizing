/**
 * invertible-bloom-filter.ts - Invertible Bloom Lookup Table (IBLT)
 *
 * An IBLT is a Bloom-like table whose cells hold a count, the XOR of the
 * stored keys, and the XOR of their fingerprints. Insertion adds a key to k
 * cells; deletion removes it. When exactly one key remains in a cell, the
 * count is one and the key sum is that key, so it can be peeled out of every
 * cell it hashes to. Repeating the peel recovers the whole remaining set,
 * which an ordinary Bloom filter cannot do.
 *
 * Time:  O(k) per insert/delete, O(n k^2) to peel n keys
 * Space: O(m) cells
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface IbltCell {
    count: number;
    keySum: number;
    hashSum: number;
}

export interface Iblt {
    size: number;
    hashCount: number;
    cells: IbltCell[];
}

/** A 32-bit avalanche fingerprint used for both placement and verification. */
function fingerprint(key: number, salt: number): number {
    let h = (Math.imul((key + salt) ^ 0x9e3779b9, 0x85ebca6b) ^ (salt * 2654435761)) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

/** The k cell positions a key occupies, using independent salts. */
function positions(key: number, hashCount: number, size: number): number[] {
    const result: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < hashCount; i += 1) {
        let pos = fingerprint(key, i * 7919 + 1) % size;
        while (seen.has(pos)) {
            pos = (pos + 1) % size;
        }
        seen.add(pos);
        result.push(pos);
    }
    return result;
}

/** Build an empty IBLT of the requested size. */
export function createIblt(size: number, hashCount: number): Iblt {
    return {
        size,
        hashCount,
        cells: Array.from({ length: size }, () => ({ count: 0, keySum: 0, hashSum: 0 })),
    };
}

/** Add a key to every cell it hashes to. */
export function ibltInsert(table: Iblt, key: number): void {
    const fp = fingerprint(key, 0);
    for (const pos of positions(key, table.hashCount, table.size)) {
        const cell = table.cells[pos];
        if (cell) {
            cell.count += 1;
            cell.keySum ^= key;
            cell.hashSum = (cell.hashSum ^ fp) >>> 0;
        }
    }
}

/** Remove a previously inserted key from every cell it hashes to. */
export function ibltDelete(table: Iblt, key: number): void {
    const fp = fingerprint(key, 0);
    for (const pos of positions(key, table.hashCount, table.size)) {
        const cell = table.cells[pos];
        if (cell) {
            cell.count -= 1;
            cell.keySum ^= key;
            cell.hashSum = (cell.hashSum ^ fp) >>> 0;
        }
    }
}

/** Peel singleton cells until no progress is possible; return recovered keys. */
export function ibltPeel(table: Iblt): { decoded: number[]; complete: boolean } {
    const cells = table.cells.map((cell) => ({ ...cell }));
    const decoded: number[] = [];
    let progress = true;
    while (progress) {
        progress = false;
        for (const cell of cells) {
            if (cell.count !== 1) {
                continue;
            }
            const key = cell.keySum;
            if (key === 0 || fingerprint(key, 0) !== cell.hashSum) {
                continue;
            }
            for (const pos of positions(key, table.hashCount, table.size)) {
                const target = cells[pos];
                if (target) {
                    target.count -= 1;
                    target.keySum ^= key;
                    target.hashSum = (target.hashSum ^ fingerprint(key, 0)) >>> 0;
                }
            }
            decoded.push(key);
            progress = true;
        }
    }
    return { decoded, complete: cells.every((cell) => cell.count === 0) };
}

function makeCells(
    cells: IbltCell[],
    cols: number,
    activePositions: number[] = [],
): VisualEntity[] {
    const active = new Set(activePositions);
    return cells.map((cell, index) => {
        const state: EntityState =
            cell.count < 0 ? "error" : active.has(index) ? "active" : cell.count > 0 ? "visited" : "idle";
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `n=${cell.count}`,
            value: cell.count,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: Math.floor(index / cols),
                col: index % cols,
                count: cell.count,
                keySum: cell.keySum,
                hashSum: cell.hashSum,
            },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            size?: number;
            hashCount?: number;
            keys?: number[];
            deletes?: number[];
        } | null
    ) ?? {};
    const size = Math.max(4, Math.trunc(task.size ?? 16));
    const hashCount = Math.min(4, Math.max(1, Math.trunc(task.hashCount ?? 3)));
    const keys = Array.isArray(task.keys) ? [...new Set(task.keys.map((k) => Math.trunc(k)))] : [3, 7, 11, 19];
    const deletes = Array.isArray(task.deletes) ? task.deletes.map((k) => Math.trunc(k)) : [7];
    const table = createIblt(size, hashCount);
    const cols = Math.min(8, size);
    const rows = Math.ceil(size / cols);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(table.cells, cols),
        edges: [],
        description: `Empty IBLT with ${size} cells and ${hashCount} hashes per key.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, size, hashCount, phase: "init", decoded: [] as number[] },
    };
    step += 1;

    for (const key of keys) {
        const pos = positions(key, hashCount, size);
        ibltInsert(table, key);
        yield {
            stepNumber: step,
            entities: makeCells(table.cells, cols, pos),
            edges: [],
            description: `Inserted key ${key} into cells ${pos.join(", ")}; counts and XOR sums updated.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows, cols, size, hashCount, phase: "insert", key, decoded: [] as number[] },
        };
        step += 1;
    }

    for (const key of deletes) {
        const pos = positions(key, hashCount, size);
        ibltDelete(table, key);
        yield {
            stepNumber: step,
            entities: makeCells(table.cells, cols, pos),
            edges: [],
            description: `Deleted key ${key} from cells ${pos.join(", ")} by reversing its contribution.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows, cols, size, hashCount, phase: "delete", key, decoded: [] as number[] },
        };
        step += 1;
    }

    const scratch = table.cells.map((cell) => ({ ...cell }));
    let peeled = 0;
    let progress = true;
    while (progress) {
        progress = false;
        let picked = -1;
        for (let i = 0; i < scratch.length; i += 1) {
            const cell = scratch[i];
            if (cell && cell.count === 1 && fingerprint(cell.keySum, 0) === cell.hashSum && cell.keySum !== 0) {
                picked = i;
                break;
            }
        }
        if (picked < 0) {
            break;
        }
        const key = scratch[picked]?.keySum ?? 0;
        const pos = positions(key, hashCount, size);
        for (const p of pos) {
            const cell = scratch[p];
            if (cell) {
                cell.count -= 1;
                cell.keySum ^= key;
                cell.hashSum = (cell.hashSum ^ fingerprint(key, 0)) >>> 0;
            }
        }
        peeled += 1;
        yield {
            stepNumber: step,
            entities: makeCells(scratch, cols, pos),
            edges: [],
            description: `Peeled key ${key} from singleton cell ${picked} and cleared it from ${pos.join(", ")}.`,
            codeLineNumber: 7,
            layout: "grid",
            meta: { rows, cols, size, hashCount, phase: "peel", key, peeled, decoded: [] as number[] },
        };
        step += 1;
        progress = true;
    }

    const expected = keys.filter((key) => !deletes.includes(key)).sort((a, b) => a - b);
    const decodedResult = ibltPeel(table);
    const decoded = decodedResult.decoded.slice().sort((a, b) => a - b);
    const success =
        decodedResult.complete &&
        decoded.length === expected.length &&
        decoded.every((value, i) => value === expected[i]);

    yield {
        stepNumber: step,
        entities: makeCells(scratch, cols),
        edges: [],
        description: success
            ? `Peeling recovered all ${decoded.length} remaining keys: ${decoded.join(", ")}.`
            : `Peeling stopped with ${peeled} key(s) recovered; some cells could not be resolved.`,
        codeLineNumber: 9,
        layout: "grid",
        meta: {
            rows,
            cols,
            size,
            hashCount,
            phase: "done",
            decoded,
            expected,
            success,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An invertible Bloom lookup table keeps just enough extra information in each cell to undo an insertion. Counts tell you when a cell holds a single key, and the XOR of the keys and fingerprints tells you which key it is. Peeling that key out of all its cells can expose more singletons, so the whole set can be recovered rather than merely tested for membership.",
        invariants: [
            "Every cell count equals the number of currently stored keys hashing to it.",
            "Each cell's key sum is the XOR of those keys and its hash sum is the XOR of their fingerprints.",
            "Removing a key restores every cell it touched to its earlier state.",
        ],
        correctness:
            "A cell with count one has exactly one contributor, so its key sum is that key and its hash sum is that key's fingerprint; the check rejects accidental collisions. Removing the verified key decrements the count and cancels its contributions in every cell it hashes to, which cannot make any count negative for a genuinely stored key. Inductively, each peel removes a real key, so if all counts reach zero the decoded list is exactly the remaining set.",
        complexityRationale:
            "Insertion and deletion touch k hash positions, so each is O(k). A peel scans m cells to find a singleton and then touches k cells, and at most n keys are peeled, giving O(n m + n k) worst case, or O(n k) with a queue of singletons. Storage is one constant-size record per cell, O(m).",
        uses: [
            "Reconciling two replicas by XORing their IBLTs and peeling the differences",
            "Set reconciliation in distributed databases and gossip protocols",
            "Teaching how a Bloom-style structure can support deletion and enumeration",
        ],
        references: [
            "Goodrich and Mitzenmacher, Invertible Bloom Lookup Tables, 2011",
            "Eppstein and Goodrich, Straggler Identification in Round-Trip Data Streams, 2011",
        ],
        workedExample:
            "With four cells and two hashes, inserting keys 3 and 7 gives cells whose counts are one. A cell with count one and key sum 7 passes the fingerprint check, so 7 is peeled out and its two cells drop to zero or to the count of key 3. The next singleton reveals 3, every count reaches zero, and the table is empty again.",
    },
    id: "invertible-bloom-filter",
    name: "Invertible Bloom Lookup Table",
    category: "data-structures",
    complexity: { time: "O(k) insert, O(n m) peel", space: "O(m)" },
    defaultInput: { size: 16, hashCount: 3, keys: [3, 7, 11, 19], deletes: [7] },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate m cells with a count, a key sum, and a fingerprint sum",
        "hash a key into k positions with independent salts",
        "on insert increment each count and xor in the key and fingerprint",
        "on delete decrement each count and xor the same values back out",
        "scan for a cell whose count is exactly one",
        "read its key sum and confirm the fingerprint matches",
        "remove that key from all k cells it hashes to",
        "append the key to the decoded set and repeat the scan",
        "stop when no singleton remains or all counts are zero",
        "report whether the remaining keys were recovered exactly",
    ],
};

export default module;
