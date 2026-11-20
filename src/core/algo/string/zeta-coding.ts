/**
 * zeta-coding.ts - Zeta coding of positive integers.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A universal variable-length code. Each integer n is split into a bucket
 * s = floor(sqrt(n)) and an offset r = n - s*s, where 0 <= r <= 2s. The bucket
 * is written in Elias gamma and the offset in a fixed-width field wide enough
 * to hold 2s. The stream is self-delimiting: a decoder reads the gamma prefix
 * to learn the bucket, then reads exactly the right offset field.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log m) for n values with largest magnitude m
 *   Space: O(n log m) for the emitted bit stream
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Character boxes show the bit stream growing one code at a time.
 *   - The final frame reports the decoded values and the round-trip verdict.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Elias gamma of a positive integer: floor(log2 n) zeros then n in binary. */
function gamma(n: number): string {
    const b = n.toString(2);
    return "0".repeat(b.length - 1) + b;
}

/** Number of bits needed to write a nonnegative integer. */
function bitLength(n: number): number {
    return n <= 0 ? 0 : Math.floor(Math.log2(n)) + 1;
}

/** Encode one positive integer with the square-root bucket zeta code. */
export function zetaEncode(n: number): string {
    const s = Math.floor(Math.sqrt(n));
    const r = n - s * s;
    const width = bitLength(2 * s);
    return gamma(s) + r.toString(2).padStart(width, "0");
}

/** Decode a concatenated zeta bit stream back into integers. */
export function zetaDecode(bits: string): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < bits.length) {
        let zeros = 0;
        while (i < bits.length && bits[i] === "0") {
            zeros += 1;
            i += 1;
        }
        if (i >= bits.length) break;
        const gammaChunk = bits.slice(i, i + zeros + 1);
        if (gammaChunk.length < zeros + 1) break;
        const s = parseInt(gammaChunk, 2);
        i += zeros + 1;
        const width = bitLength(2 * s);
        const offsetBits = bits.slice(i, i + width);
        if (offsetBits.length < width) break;
        const r = parseInt(offsetBits, 2);
        i += width;
        out.push(s * s + r);
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { numbers?: number[] } | null) ?? {};
    const raw = Array.isArray(cfg.numbers)
        ? (cfg.numbers as number[]).filter((v) => Number.isInteger(v) && v >= 1).slice(0, 8)
        : [];
    const nums = raw.length > 0 ? raw : [1, 2, 3, 4, 5];
    const codes = nums.map(zetaEncode);
    const allBits = codes.join("");
    const roundTrip = zetaDecode(allBits).join(",") === nums.join(",");
    let step = 0;
    let shown = 0;

    const frame = (desc: string, line: number): VisualFrame => {
        const visible = codes.slice(0, shown).join("");
        const entities: VisualEntity[] = [...visible].map((b, i) => ({
            id: `bit-${i}`,
            type: "character" as const,
            label: b,
            value: b,
            state: "sorted" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        if (entities.length === 0) {
            entities.push({
                id: "bit-empty",
                type: "character" as const,
                label: "~",
                value: "~",
                state: "idle" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: 0 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 8),
            layout: "text",
            meta: { numbers: nums, codes, bits: visible, roundTrip, shown },
        };
    };

    yield frame(`Zeta coding ${nums.length} integers: ${nums.join(", ")}.`, 0);
    step += 1;
    for (let t = 0; t < nums.length; t += 1) {
        shown = t + 1;
        const n = nums[t] as number;
        const s = Math.floor(Math.sqrt(n));
        yield frame(
            `${n} splits into bucket ${s} plus offset ${n - s * s}, coded as ${codes[t]}.`,
            Math.min(t + 1, 8),
        );
        step += 1;
    }
    shown = nums.length;
    yield frame(
        `Stream decodes to [${zetaDecode(allBits).join(", ")}]; round trip ${roundTrip ? "verified" : "failed"}.`,
        8,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Zeta coding is a universal code for positive integers that groups nearby values into buckets. It writes the bucket number with a short self-delimiting gamma code, then writes the position inside that bucket as a fixed-width field. Large values get longer codes while small, common values stay compact, and the whole stream decodes without any separators.",
        invariants: [
            "For every n the bucket s = floor(sqrt(n)) and offset r = n - s*s satisfy 0 <= r <= 2s.",
            "The gamma prefix is prefix-free, so the decoder always knows where the offset field begins.",
            "The offset field width floor(log2(2s)) + 1 is wide enough to hold any legal offset.",
        ],
        correctness:
            "Because (s+1)^2 = s^2 + 2s + 1 is strictly greater than n, the offset r is at most 2s and fits in the chosen field. Elias gamma is prefix-free, so counting zeros until the first one recovers s uniquely, and the field width then tells the decoder exactly how many bits to read for r. Rebuilding s*s + r returns the original n, so decoding every code recovers the whole list; the demo verifies this round trip explicitly.",
        complexityRationale:
            "Encoding a value n writes about 2 log s + log(2s) bits, which is O(log n). A list of n values with largest magnitude m takes O(n log m) time and emits O(n log m) bits, and the only storage is the output bit stream.",
        uses: [
            "Compressing integer sequences such as document gaps and posting lists",
            "Prefix coding when the value distribution is not known in advance",
            "Compact representation of sorted integer arrays",
        ],
        references: [
            "Elias, Universal Codeword Sets and Representations of the Integers, IEEE Transactions on Information Theory, 1975",
            "Salomon, Data Compression: The Complete Reference, universal codes chapter",
        ],
        workedExample:
            "For n = 8 the bucket is s = 2 and the offset is 8 - 4 = 4. Gamma of 2 is 010 and 4 in three bits is 100, so the code is 010100. Decoding reads 010 to get s = 2, reads 100 to get r = 4, and rebuilds 4 + 4 = 8.",
    },
    id: "zeta-coding",
    name: "Zeta Coding",
    category: "string",
    complexity: { time: "O(n log m)", space: "O(n log m)" },
    defaultInput: { numbers: [1, 2, 3, 4, 5] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize an empty bit stream",
        "for each positive integer n in the input list",
        "set bucket s to floor(sqrt(n)) and offset r to n minus s squared",
        "append the Elias gamma code of s to the stream",
        "append r in a field of floor(log2(2s)) plus one bits",
        "decode by reading a gamma prefix to recover the bucket s",
        "read the offset field and rebuild n as s squared plus r",
        "compare the rebuilt list with the original input list",
        "done: emit the self-delimiting zeta bit stream",
    ],
};

export default module;
