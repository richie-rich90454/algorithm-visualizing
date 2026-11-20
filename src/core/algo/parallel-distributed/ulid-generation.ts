/**
 * ulid-generation.ts - Universally Unique Lexicographically Sortable Identifier
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A ULID packs a 48-bit millisecond timestamp and 80 bits of randomness into a
 * 128-bit value, then writes that value in Crockford base 32 as 26 characters.
 * Because the timestamp occupies the high bits, string order matches time
 * order; when timestamps tie, the random part breaks the tie deterministically.
 * A small seeded generator supplies the random bits so the visualization is
 * reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per identifier - 26 fixed-width base-32 digits
 *   Space: O(1) for the 128-bit accumulator
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar is drawn per generated ULID; its label is the full 26-char value.
 *   - A newly generated bar is highlighted; the final frame shows the ULIDs
 *     rearranged into lexicographic (and therefore time) order.
 *   - Frame metadata carries the exact timestamp and random bits for checking
 *     the base-32 round trip.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIMESTAMP_BITS = 48n;
const RANDOM_BITS = 80n;
const RANDOM_MASK = (1n << RANDOM_BITS) - 1n;

/** Reproducible 32-bit linear congruential generator state. */
function makeRandom(seed: number) {
    let state = BigInt(seed >>> 0);
    return () => {
        state = (state * 1664525n + 1013904223n) & 0xffffffffn;
        return state;
    };
}

/** Draw 80 random bits as five 16-bit words. */
function nextRandom(next32: () => bigint): bigint {
    let value = 0n;
    for (let i = 0; i < 5; i += 1) {
        value = (value << 16n) | (next32() & 0xffffn);
    }
    return value & RANDOM_MASK;
}

/** Encode a 128-bit value into a 26-character Crockford base-32 ULID. */
function encode(timestamp: number, random: bigint): string {
    let value = (BigInt(timestamp) << RANDOM_BITS) | (random & RANDOM_MASK);
    let out = "";
    for (let i = 0; i < 26; i += 1) {
        const shift = BigInt(25 - i) * 5n;
        const digit = Number((value >> shift) & 31n);
        out += ALPHABET[digit];
    }
    return out;
}

function makeBars(
    ulids: Array<{ value: string; timestamp: number }>,
    highlight: number,
    state: EntityState,
): VisualEntity[] {
    return ulids.map((item, index) => ({
        id: `ulid-${index}`,
        type: "bar" as const,
        label: item.value,
        value: item.timestamp,
        state: index === highlight ? "highlight" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, ulid: item.value, timestamp: item.timestamp },
    }));
}

/** The ULID generation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { timestamps?: number[]; seed?: number } | null) ?? {};
    const timestamps = Array.isArray(task.timestamps) && task.timestamps.length > 0
        ? task.timestamps.map((t) => Math.max(0, Math.floor(Number(t))))
        : [1600000000000, 1600000000000, 1600000000001, 1600000000002];
    const next32 = makeRandom(typeof task.seed === "number" ? task.seed : 42);

    const generated: Array<{ value: string; timestamp: number; random: bigint }> = [];
    let step = 0;

    for (let i = 0; i < timestamps.length; i += 1) {
        const timestamp = Math.min(timestamps[i] ?? 0, Number((1n << TIMESTAMP_BITS) - 1n));
        const random = nextRandom(next32);
        const value = encode(timestamp, random);
        generated.push({ value, timestamp, random });

        const bars = generated.map((g) => ({ value: g.value, timestamp: g.timestamp }));
        yield {
            stepNumber: step,
            entities: makeBars(bars, i, "idle"),
            edges: [],
            description: `Generated ULID ${i + 1} from timestamp ${timestamp} and 80 random bits: ${value}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                count: generated.length,
                ulids: generated.map((g) => g.value),
                timestamps: generated.map((g) => g.timestamp),
                randoms: generated.map((g) => g.random.toString(16)),
            },
        };
        step += 1;
    }

    const sorted = [...generated].sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
    yield {
        stepNumber: step,
        entities: makeBars(
            sorted.map((g) => ({ value: g.value, timestamp: g.timestamp })),
            -1,
            "sorted",
        ),
        edges: [],
        description: "Sorting ULIDs as strings puts them in timestamp order; the random part breaks ties.",
        codeLineNumber: 5,
        layout: "array",
        meta: {
            count: generated.length,
            ulids: generated.map((g) => g.value),
            timestamps: generated.map((g) => g.timestamp),
            randoms: generated.map((g) => g.random.toString(16)),
            sortedUlids: sorted.map((g) => g.value),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A ULID is a 128-bit number written in a 32-character alphabet. The first 48 bits are the current time in milliseconds and the remaining 80 bits are random. Putting time in the high bits means that sorting the identifier strings as plain text also sorts them by creation time, while the random tail keeps identifiers unique even inside the same millisecond.",
        invariants: [
            "Every encoding is exactly 26 Crockford base-32 characters.",
            "The high 48 bits equal the input timestamp and the low 80 bits equal the random value.",
            "String order agrees with numeric order of the full 128-bit value.",
        ],
        correctness:
            "Crockford base 32 assigns each 5-bit group one distinct character, so converting a 128-bit value to 26 digits is a bijection on the values below 2^128 (the top two bit positions stay zero, so the first digit is 0 through 7). Because more significant digits come first and the alphabet is ordered, lexicographic string order equals numeric order. Numeric order is timestamp order first and random order second, which is the desired sort key.",
        complexityRationale:
            "Encoding inspects each of the 26 digits once, so time and space are both constant per identifier regardless of how many identifiers exist. Generating the 80 random bits is a fixed number of draws from the seeded generator.",
        uses: [
            "Time-ordered primary keys in databases and distributed systems",
            "Correlation identifiers that sort chronologically in logs",
            "Client-side unique IDs that need monotonic ordering without coordination",
        ],
        references: [
            "ULID specification, ulid.github.io, 2016",
            "Crockford, Binary to Text Encoding: The Base 32 Encoding, 2002",
        ],
        workedExample:
            "A timestamp of 1600000000000 and random bits of zero encode to the high digits 01BX5ZZK, so the ULID begins 01BX5ZZK... . A ULID from one millisecond later begins with a larger prefix and therefore sorts after it as a string, even though both are just text.",
    },
    id: "ulid-generation",
    name: "ULID Generation",
    category: "parallel-distributed",
    complexity: { time: "O(1) per ULID", space: "O(1)" },
    defaultInput: { timestamps: [1600000000000, 1600000000000, 1600000000001, 1600000000002], seed: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "read the millisecond timestamp and split it into 48 bits",
        "draw 80 random bits from the seeded generator",
        "concatenate timestamp bits above random bits into 128 bits",
        "for each of 26 output digits take the top five remaining bits",
        "map that five-bit group to its Crockford base-32 character",
        "emit the 26 characters as the identifier",
        "sort the generated identifiers as plain strings",
        "done: string order matches timestamp then random order",
    ],
};

export default module;
