/**
 * reed-solomon-erasure-coding.ts - Reed-Solomon Erasure Coding over GF(256)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Reed-Solomon erasure coding extends k data shards with m parity shards so
 * that any k of the n = k + m shards reconstruct the whole original. All
 * bytes live in the finite field GF(256): the data shards are values of a
 * degree-(k-1) polynomial at x = 0..k-1, and parity shards are that polynomial
 * evaluated at later points. Lagrange interpolation over any k surviving
 * points recovers the polynomial and therefore every missing shard.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * n + k^2) for encoding and decoding with field arithmetic
 *   Space: O(n) for the shards and the interpolation points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per shard, its height encoding the byte value.
 *   - Parity shards are purple, erased shards red, recovered shards green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Multiply two field elements in GF(256) with primitive polynomial 0x11d. */
function gmul(a: number, b: number): number {
    let left = a & 0xff;
    let right = b & 0xff;
    let result = 0;
    while (right !== 0) {
        if (right & 1) result ^= left;
        const high = left & 0x80;
        left = (left << 1) & 0xff;
        if (high) left ^= 0x1d;
        right >>= 1;
    }
    return result;
}

const EXP: number[] = new Array(512).fill(0);
const LOG: number[] = new Array(256).fill(0);

/** Build the discrete logarithm tables using generator 2. */
(function buildTables(): void {
    let value = 1;
    for (let i = 0; i < 255; i += 1) {
        EXP[i] = value;
        LOG[value] = i;
        value = gmul(value, 2);
    }
    for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255] as number;
})();

/** Multiplicative inverse in GF(256). */
function ginv(a: number): number {
    if (a === 0) return 0;
    return EXP[255 - (LOG[a] as number)] as number;
}

/** Evaluate the interpolated polynomial at x using Lagrange's formula. */
function interpolate(points: Array<[number, number]>, x: number): number {
    let result = 0;
    for (let i = 0; i < points.length; i += 1) {
        const [xi, yi] = points[i] as [number, number];
        let term = yi;
        for (let j = 0; j < points.length; j += 1) {
            if (j === i) continue;
            const [xj] = points[j] as [number, number];
            if (xi === xj) continue;
            const numerator = x ^ (xj as number);
            const denominator = xi ^ (xj as number);
            term = gmul(term, gmul(numerator, ginv(denominator)));
        }
        result ^= term;
    }
    return result;
}

/** Build one bar per shard. */
function makeBars(shards: number[], k: number, erased: number[], recovered: boolean, showErased: boolean, showRecovered: boolean): VisualEntity[] {
    const erasedSet = new Set(erased);
    return shards.map((value, index) => {
        let state: EntityState = index < k ? "visited" : "pivot";
        if (showErased && erasedSet.has(index)) state = "error";
        if (showRecovered && recovered && erasedSet.has(index)) state = "sorted";
        return {
            id: `shard-${index}`,
            type: "bar" as const,
            label: `${index}: ${value}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, byte: value, parity: index >= k },
        };
    });
}

/** The Reed-Solomon generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; parityShards?: number; erased?: number[] } | null) ?? {};
    const data = Array.isArray(task.data) && task.data.length > 0
        ? task.data.map((b) => Math.max(0, Math.min(255, Math.floor(Number(b)))))
        : [12, 45, 200, 77];
    const k = data.length;
    const m = typeof task.parityShards === "number" ? Math.max(1, Math.floor(task.parityShards)) : 2;
    const n = k + m;
    const points: Array<[number, number]> = data.map((value, index) => [index, value]);
    const shards: number[] = [];
    for (let i = 0; i < n; i += 1) {
        shards.push(i < k ? (data[i] as number) : interpolate(points, i));
    }
    let erased = Array.isArray(task.erased)
        ? task.erased.map((e) => Math.floor(Number(e))).filter((e) => e >= 0 && e < n)
        : [1];
    erased = [...new Set(erased)].slice(0, m);

    yield {
        stepNumber: 0,
        entities: makeBars(shards, k, erased, false, false, false),
        edges: [],
        description: `Encoded ${k} data shard(s) into ${n} total shard(s) with ${m} parity shard(s) over GF(256).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, m, n, data: [...data], parity: shards.slice(k), shards: [...shards], erased: [], recovered: false },
    };
    let step = 1;

    yield {
        stepNumber: step,
        entities: makeBars(shards, k, erased, false, true, false),
        edges: [],
        description: `Erased ${erased.length} shard(s) at indices ${erased.join(", ") || "none"}; ${n - erased.length} remain.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { k, m, n, data: [...data], parity: shards.slice(k), shards: [...shards], erased: [...erased], recovered: false },
    };
    step += 1;

    const survivors: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        if (!erased.includes(i)) survivors.push([i, shards[i] as number]);
    }
    const canRecover = survivors.length >= k;
    let recoveredShards = [...shards];
    let recovered = false;
    if (canRecover) {
        const basis = survivors.slice(0, k);
        recoveredShards = [];
        for (let i = 0; i < n; i += 1) recoveredShards.push(interpolate(basis, i));
        recovered = recoveredShards.every((value, index) => value === shards[index]);
    }

    yield {
        stepNumber: step,
        entities: makeBars(recoveredShards, k, erased, recovered, true, true),
        edges: [],
        description: canRecover
            ? `Interpolated from ${survivors.length} surviving shard(s); all ${n} shards ${recovered ? "reconstructed correctly" : "failed to reconstruct"}.`
            : `Only ${survivors.length} shard(s) survived but ${k} are needed; recovery is impossible.`,
        codeLineNumber: canRecover ? 5 : 4,
        layout: "array",
        meta: {
            k,
            m,
            n,
            data: [...data],
            parity: shards.slice(k),
            shards: recoveredShards,
            erased: [...erased],
            recovered,
        },
    };
}

/** The Reed-Solomon module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat the data shards as points on a polynomial and add extra points as parity. Any k points determine a polynomial of degree k minus one, so losing up to m shards never destroys the information. Reconstructing is just fitting the polynomial through whichever shards survived and reading off the missing values.",
        invariants: [
            "All k plus m shards lie on one polynomial of degree less than k.",
            "The first k shards equal the original data bytes.",
            "Any k distinct shards uniquely determine every other shard.",
        ],
        correctness:
            "A polynomial of degree less than k is uniquely determined by k distinct evaluation points. Encoding evaluates that polynomial at n distinct field elements; decoding interpolates the degree-(k-1) polynomial through any k survivors, which must be the same polynomial, so its values at all n points equal the original shards. Arithmetic in GF(256) is exact because field operations are closed and every nonzero element has an inverse.",
        complexityRationale:
            "Encoding evaluates a degree-(k-1) polynomial at n points, costing O(k n) field operations, and decoding interpolates over k points for n targets, costing O(k n) as well. Storing the n shards uses O(n) space.",
        uses: [
            "Protecting data in distributed storage systems such as HDFS and Ceph",
            "Forward error correction in optical networking and broadcasting",
            "Redundant sharding in object stores and archival systems",
        ],
        references: [
            "Reed and Solomon, Polynomial Codes over Certain Finite Fields, 1960",
            "Plugwash and the Vandermonde literature, Understanding Reed-Solomon Coding, 2013",
        ],
        workedExample:
            "With two data bytes 10 and 20 and one parity shard, the polynomial through (0,10) and (1,20) is evaluated at x = 2 to make a third shard. If the byte at x = 0 is lost, interpolating through (1,20) and (2,parity) recovers 10 exactly.",
    },
    id: "reed-solomon-erasure-coding",
    name: "Reed-Solomon Erasure Coding",
    category: "production-systems",
    complexity: { time: "O(k * n)", space: "O(n)" },
    defaultInput: { data: [12, 45, 200, 77], parityShards: 2, erased: [1] },
    visualType: "array",
    run,
    pseudocode: [
        "for each data byte place a point at x equal to its index",
        "for each parity index interpolate the polynomial at that x",
        "record all data and parity shards",
        "mark the erased shards as lost",
        "if at least k shards remain, interpolate through them",
        "rebuild the missing shards from the recovered polynomial",
        "done: report whether reconstruction matched the originals",
    ],
};

export default module;
