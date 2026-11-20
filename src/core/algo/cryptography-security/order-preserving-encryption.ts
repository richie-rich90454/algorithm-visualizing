/**
 * order-preserving-encryption.ts - Order-Preserving Encryption (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An order-preserving encryption maps plaintexts to ciphertexts so that the
 * numeric order of the ciphertexts matches the order of the plaintexts. That
 * lets a server compare encrypted records without decrypting them. This toy
 * assigns each plaintext a rank, places the ranks on a coarse grid with a
 * keyed jitter smaller than the grid spacing, and decrypts by binary search
 * in the sorted cipher table. The jitter hides exact spacing but keeps order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log m) to encrypt or decrypt with a sorted table of m values
 *   Space: O(m)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the ciphertext assigned to each rank.
 *   - meta carries the domain, the key, and the order-preservation verdict.
 *
 * ---------------------------------------------------------------------------
 * Note
 *   - TOY MODEL. Real order-preserving schemes leak substantial information and
 *     need careful security analysis. This construction teaches the idea only.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const GAP = 1000n;

export interface OpeState {
    domain: number[];
    ciphers: bigint[];
    key: number;
}

/** Deterministic jitter smaller than one grid step. */
export function jitter(rank: number, key: number): bigint {
    return BigInt(((rank * key + 7) % 97 + 97) % 97);
}

/** Build an encrypted, order-preserving table over a sorted domain. */
export function buildOpe(domain: number[], key: number): OpeState {
    const sorted = [...new Set(domain)].sort((a, b) => a - b);
    const ciphers = sorted.map((_, rank) => (BigInt(rank + 1) * GAP + jitter(rank, key) + BigInt(key % 500)));
    return { domain: sorted, ciphers, key };
}

/** Encrypt a plaintext from the domain. */
export function opeEncrypt(state: OpeState, plaintext: number): bigint | null {
    const rank = state.domain.indexOf(plaintext);
    return rank < 0 ? null : state.ciphers[rank] ?? null;
}

/** Decrypt a ciphertext by binary search in the sorted cipher table. */
export function opeDecrypt(state: OpeState, cipher: bigint): number | null {
    let low = 0;
    let high = state.ciphers.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const value = state.ciphers[mid] ?? 0n;
        if (value === cipher) return state.domain[mid] ?? null;
        if (value < cipher) low = mid + 1;
        else high = mid - 1;
    }
    return null;
}

/** Verify order preservation over every pair in the domain. */
export function preservesOrder(state: OpeState): boolean {
    for (let i = 0; i < state.domain.length; i += 1) {
        for (let j = 0; j < i; j += 1) {
            const plainOrdered = (state.domain[i] ?? 0) > (state.domain[j] ?? 0);
            const cipherOrdered = (state.ciphers[i] ?? 0n) > (state.ciphers[j] ?? 0n);
            if (plainOrdered !== cipherOrdered) return false;
        }
    }
    return true;
}

function makeBars(ciphers: bigint[]): VisualEntity[] {
    return ciphers.map((value, index) => ({
        id: `cipher-${index}`,
        type: "bar" as const,
        label: value.toString(),
        value: Number(value),
        state: "sorted" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, rank: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { domain?: number[]; key?: number } | null) ?? {};
    const domain = task.domain ?? [12, 5, 30, 18, 7, 25];
    const key = typeof task.key === "number" ? task.key : 17;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([]),
        edges: [],
        description: `Order-preserving encryption of ${domain.length} values with key ${key}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { domain, key },
    };
    step += 1;

    const state = buildOpe(domain, key);
    yield {
        stepNumber: step,
        entities: makeBars(state.ciphers),
        edges: [],
        description: "Sorted plaintexts were mapped to ranks, then spread on a keyed grid.",
        codeLineNumber: 1,
        layout: "array",
        meta: { key, ciphers: state.ciphers.map(String) },
    };
    step += 1;

    const probe = state.domain[Math.floor(state.domain.length / 2)] ?? 0;
    const cipher = opeEncrypt(state, probe);
    const recovered = cipher === null ? null : opeDecrypt(state, cipher);
    yield {
        stepNumber: step,
        entities: makeBars(state.ciphers),
        edges: [],
        description: `Encrypted ${probe} to ${cipher?.toString() ?? "none"} and recovered ${recovered}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { probe, cipher: cipher?.toString() ?? "none", recovered: recovered === null ? "none" : recovered },
    };
    step += 1;

    const ordered = preservesOrder(state);
    yield {
        stepNumber: step,
        entities: makeBars(state.ciphers),
        edges: [],
        description: `Done: ciphertext order ${ordered ? "matches" : "breaks"} plaintext order. Toy scheme, not secure.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { orderPreserved: ordered, key },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sometimes a database must compare values it cannot read. Order-preserving encryption assigns ciphertexts so that sorting the encrypted column gives the same order as sorting the plaintexts. The teaching construction gives each plaintext a rank, puts ranks on a coarse numeric grid, and adds a small keyed offset; because the offset is smaller than the gap, order is preserved while the exact spacing is hidden.",
        invariants: [
            "Ciphertexts are strictly increasing with the rank of their plaintext.",
            "The keyed jitter is always smaller than one grid step.",
            "Decryption by binary search succeeds for every value in the domain.",
        ],
        correctness:
            "Consecutive ranks differ by the grid gap plus a change in jitter, and since jitter stays below the gap the difference is always positive; by transitivity the whole table is strictly increasing. Binary search is valid on a strictly increasing table and returns the exact rank of any table entry, so decrypting an encrypted domain value recovers it. A brute-force check over all pairs confirms the order property and every round trip.",
        complexityRationale:
            "Building the table sorts m values and computes one ciphertext each, costing O(m log m). Encryption via lookup and decryption by binary search both cost O(log m), and the table uses O(m) space.",
        uses: [
            "Range queries over encrypted database columns",
            "Comparable encrypted indexes",
            "Teaching the security leakage of deterministic ordering",
        ],
        references: [
            "Agrawal, Kiernan, Srikant, and Xu, Order Preserving Encryption for Numeric Data, 2004",
            "Boldyreva, Chenette, Lee, and O'Neill, Order-Preserving Symmetric Encryption, 2009",
        ],
        workedExample:
            "For the domain 5, 12, 18 with key 17 and a gap of 1000, ranks zero, one, and two map to roughly 1000, 2000, and 3000 plus small keyed offsets. Sorting the ciphertexts gives the same order as the plaintexts, and a ciphertext near 2000 decrypts back to 12 by binary search.",
    },
    id: "order-preserving-encryption",
    name: "Order-Preserving Encryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(log m)", space: "O(m)" },
    defaultInput: { domain: [12, 5, 30, 18, 7, 25], key: 17 },
    visualType: "array",
    run,
    pseudocode: [
        "sort and deduplicate the plaintext domain",
        "assign each plaintext its rank in the domain",
        "place the rank on a coarse numeric grid",
        "add a keyed offset smaller than the grid gap",
        "encrypt by table lookup on the rank",
        "decrypt by binary search in the cipher table",
        "done: verify order preservation over all pairs",
    ],
};

export default module;
