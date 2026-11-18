/**
 * delta-compression-gorilla.ts - Gorilla Delta Compression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gorilla compresses a time series of numbers by XORing each value with the
 * previous one. A zero XOR costs a single bit. A nonzero XOR is reduced to its
 * meaningful bits between the leading and trailing zeros: if those fit inside
 * the previous meaningful window, only the payload is written; otherwise the
 * window is sent again. Repeated or slowly changing values therefore collapse
 * to very few bits.
 *
 * This is a small, exact teaching simulator over 32-bit integer values. The
 * bitstream and the decode step are faithful to the Gorilla XOR scheme, but it
 * is not a full timestamp-plus-float implementation and does not interoperate
 * with a specific on-disk Gorilla file format.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to encode and decode n values
 *   Space: O(bits) for the bitstream plus O(n) for the reported arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per value shows the value being encoded.
 *   - The current value is yellow; encoded values are green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GorillaInput {
    values?: number[];
}

/** Number of trailing zero bits in a nonzero 32-bit word. */
function trailingZeros(word: number): number {
    if (word === 0) {
        return 32;
    }
    const low = (word & -word) >>> 0;
    return 31 - Math.clz32(low);
}

function writeBits(bits: string[], value: number, count: number): void {
    for (let k = count - 1; k >= 0; k -= 1) {
        bits.push(String((value >>> k) & 1));
    }
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${index}: ${value}`,
        value,
        state: done || index < current ? ("sorted" as const) : index === current ? ("comparing" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, k: index },
    }));
}

/** The Gorilla delta compression generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GorillaInput | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Math.floor(Number(v)) >>> 0)
        : [100, 100, 100, 110, 110, 200, 200, 200, 205];
    const n = values.length;
    const note = "small Gorilla XOR simulator on 32-bit integers: no timestamps or float bit layout";

    const xors = new Array<number>(n).fill(0);
    const leadingZeros = new Array<number>(n).fill(0);
    const meaningfulBits = new Array<number>(n).fill(0);
    const bitsPerValue = new Array<number>(n).fill(0);
    const bits: string[] = [];
    let previous = values[0] ?? 0;
    let windowLeading = 0;
    let windowTrailing = 0;
    let windowMeaningful = 0;

    for (let i = 1; i < n; i += 1) {
        const value = values[i] ?? 0;
        const xor = (value ^ previous) >>> 0;
        xors[i] = xor;
        if (xor === 0) {
            bits.push("0");
            bitsPerValue[i] = 1;
            leadingZeros[i] = 32;
            meaningfulBits[i] = 0;
        } else {
            const leading = Math.clz32(xor);
            const trailing = trailingZeros(xor);
            const meaningful = 32 - leading - trailing;
            leadingZeros[i] = leading;
            meaningfulBits[i] = meaningful;
            bits.push("1");
            if (windowMeaningful > 0 && leading >= windowLeading && trailing >= windowTrailing) {
                // Reuse the previous window: write a fixed-width payload aligned to its low edge.
                bits.push("0");
                writeBits(bits, xor >>> windowTrailing, windowMeaningful);
                bitsPerValue[i] = 2 + windowMeaningful;
            } else {
                bits.push("1");
                writeBits(bits, leading, 5);
                writeBits(bits, meaningful, 6);
                writeBits(bits, xor >>> trailing, meaningful);
                bitsPerValue[i] = 2 + 5 + 6 + meaningful;
                windowLeading = leading;
                windowTrailing = trailing;
                windowMeaningful = meaningful;
            }
        }
        previous = value;
    }

    const bitstream = bits.join("");
    const totalBits = bitstream.length;
    const rawBits = n * 32;

    const metadata = (): Record<string, number | string | boolean | Array<number | string>> => ({
        valueCount: n,
        values: [...values],
        xors: [...xors],
        leadingZeros: [...leadingZeros],
        meaningfulBits: [...meaningfulBits],
        bitsPerValue: [...bitsPerValue],
        bitstream,
        totalBits,
        rawBits,
        note,
    });
    const meta0 = metadata();
    meta0["xors"] = xors.map(() => 0);
    meta0["bitsPerValue"] = bitsPerValue.map(() => 0);
    meta0["totalBits"] = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Encoding ${n} values with Gorilla XOR deltas; each value costs a control code plus only its meaningful bits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta0,
    };

    let step = 1;
    for (let i = 1; i < n; i += 1) {
        const meta = metadata();
        meta["currentIndex"] = i;
        meta["currentXor"] = xors[i] ?? 0;
        meta["currentBits"] = bitsPerValue[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false),
            edges: [],
            description: `Value ${i} XORs to ${xors[i] ?? 0} (leading zeros ${leadingZeros[i]}, meaningful bits ${meaningfulBits[i]}), using ${bitsPerValue[i]} bit(s).`,
            codeLineNumber: xors[i] === 0 ? 2 : leadingZeros[i] === 0 ? 4 : 3,
            layout: "array",
            meta,
        };
        step += 1;
    }

    const finalMeta = metadata();
    finalMeta["currentIndex"] = -1;
    yield {
        stepNumber: step,
        entities: makeBars(values, n, true),
        edges: [],
        description: `Encoded ${n} values in ${totalBits} bits versus ${rawBits} raw bits (${((100 * totalBits) / rawBits).toFixed(1)} percent). Exact XOR simulator, not a full Gorilla file format.`,
        codeLineNumber: 6,
        layout: "array",
        meta: finalMeta,
    };
}

/** The Gorilla delta compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When consecutive numbers are similar, their binary patterns agree in most places. XOR makes those agreeing bits zero, leaving only the part that changed. If the changed part sits in the same place as last time, you can reuse that description and send just the payload. Identical values collapse to a single zero bit, so flat stretches are almost free.",
        invariants: [
            "The XOR of two values is zero exactly when the values are equal.",
            "A zero XOR emits only the single control bit and leaves the window unchanged.",
            "Decoding the bitstream recovers every original value exactly.",
        ],
        correctness:
            "For each value the encoder writes w xor previousValue. On decode, XORing the recovered XOR with the previous decoded value returns the original by the involution property of XOR. The control bits uniquely distinguish zero, window reuse, and a new window, and leading, meaningful, and payload fields fully specify any nonzero XOR, so the stream is lossless and unambiguous.",
        complexityRationale:
            "Encoding scans each value once and writes at most 19 plus the meaningful bit count, so the time is O(n). The bitstream holds O(bits) characters and the reported parallel arrays use O(n) space.",
        uses: [
            "Compressing regularly sampled sensor and metric time series",
            "Reducing storage for timestamps and counters in monitoring databases",
            "A teaching model for XOR-based delta encoding",
        ],
        references: [
            "Pelkonen et al., Gorilla: A Fast, Scalable, In-Memory Time Series Database, 2015",
            "RFC 1951 style bit packing discussions in time-series storage literature",
        ],
        workedExample:
            "Encoding 100, 100, 100, 110: the second and third values repeat, so each costs one bit (zero XOR). The jump to 110 has XOR 14, which needs a new window: 28 leading zeros, 3 meaningful bits, payload 111. The decoded sequence reconstructs 100, 100, 100, 110 exactly.",
    },
    id: "delta-compression-gorilla",
    name: "Gorilla Delta Compression (Small XOR Simulator)",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(bits)" },
    defaultInput: { values: [100, 100, 100, 110, 110, 200, 200, 200, 205] },
    visualType: "array",
    run,
    pseudocode: [
        "read the sequence of integer values",
        "for each value after the first, XOR with the previous",
        "if the XOR is zero, write a single zero bit",
        "otherwise locate the leading and trailing zeros",
        "reuse the window if the payload fits, else write a new one",
        "append the meaningful payload bits",
        "done: report the bitstream and compression ratio",
    ],
};

export default module;
