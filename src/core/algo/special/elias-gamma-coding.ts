/**
 * elias-gamma-coding.ts – Elias gamma coding.
 * [1,2,3,4,5] → 1|010|011|00100|00101: each n writes ⌊log2 n⌋ zeros,
 * then n in binary. Decoding counts zeros to know each length;
 * round-trip is verified, not assumed.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const enc = (n: number): string => {
    const b = n.toString(2);
    return "0".repeat(b.length - 1) + b;
};

function dec(bits: string): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < bits.length) {
        let z = 0;
        while (bits[i] === "0") {
            z += 1;
            i += 1;
        }
        const chunk = bits.slice(i, i + z + 1);
        if (chunk.length < z + 1) break;
        out.push(parseInt(chunk, 2));
        i += z + 1;
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { numbers?: number[] } | null) ?? {};
    const nums =
        Array.isArray(cfg.numbers) && cfg.numbers.length > 0
            ? (cfg.numbers as number[]).filter((v) => Number.isInteger(v) && v >= 1).slice(0, 8)
            : [1, 2, 3, 4, 5];
    if (nums.length === 0) nums.push(1);
    const codes = nums.map(enc);
    const roundTrip = dec(codes.join("")).join(",") === nums.join(",");
    let step = 0;
    let shown = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const bits = codes.slice(0, shown).join("");
        const entities: VisualEntity[] = [...bits].map((b, i) => ({
            id: `bit-${i}`,
            type: "character" as const,
            label: b,
            value: b,
            state: "sorted" as EntityState,
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
                label: "∅",
                value: "∅",
                state: "idle" as EntityState,
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
            codeLineNumber: Math.min(line, 6),
            layout: "text",
            meta: { bits, roundTrip },
        };
    };
    yield frame(
        `Gamma codes grow with size: ${nums.join(",")} need ${codes.map((c) => c.length).join("+")} bits total.`,
        0,
    );
    step += 1;
    for (let t = 0; t < nums.length && step < 13; t += 1) {
        shown = t + 1;
        yield frame(
            `${nums[t]} → ${codes[t]} (${(codes[t] ?? "").length - 1} zeros + binary).`,
            t + 1,
        );
        step += 1;
    }
    yield frame(
        `Stream decodes back to [${dec(codes.join("")).join(",")}] (match: ${roundTrip}).`,
        nums.length + 1,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Elias gamma coding encodes a positive integer by writing floor(log2 n) zero bits followed by the ordinary binary form of n. The count of leading zeros tells the decoder how long the following binary chunk is, so the code is self-delimiting and needs no separators. Small integers get short codes, making it useful when values cluster near one.",
        "invariants": [
            "Each code begins with exactly floor(log2 n) zeros followed by the (floor(log2 n)+1)-bit binary of n.",
            "The codes are prefix-free, so a concatenated stream decodes unambiguously.",
            "Decoding the concatenated codes recovers the original list of numbers."
        ],
        "correctness": "The binary representation of n has exactly floor(log2 n)+1 bits, so counting leading zeros tells the decoder precisely how many bits to read next. Because no valid code is a prefix of another, parsing a concatenated stream is unique. The demo verifies the round trip explicitly.",
        "complexityRationale": "Encoding a value n writes 2·floor(log2 n)+1 bits, so a list of n values with largest magnitude M takes O(n log M) time and produces O(n log M) bits. Storage is just the output bit stream.",
        "uses": [
            "Compressing integer sequences in search-engine inverted indexes",
            "Encoding gaps in posting lists and delta arrays",
            "Prefix codes for small-integer alphabets",
            "Lossless compression in information retrieval"
        ],
        "references": [
            "Elias, Universal Codeword Sets and Representations of the Integers, IEEE Transactions on Information Theory, 1975",
            "Cover and Thomas, Elements of Information Theory, Chapter 5"
        ],
        "workedExample": "To encode 4, whose binary '100' has three bits, write two zeros then '100' to get '00100'; 5 becomes '00101'. The stream for [1,2,3,4,5] is '1|010|011|00100|00101'. Decoding '00' means read three bits, which reconstructs 4, and so on back to the full list."
    },
    id: "elias-gamma-coding",
    name: "Elias Gamma Coding",
    category: "string",
    complexity: { time: "O(n log m)", space: "O(n log m)" },
    defaultInput: { numbers: [1, 2, 3, 4, 5] },
    visualType: "text",
    run,
    pseudocode: [
        "initialize empty bit stream for numbers list",
        "for each value n compute zeros <- floor(log2 n)",
        "write zeros zero-bits followed by n in binary",
        "append the code to the growing bit stream",
        "decode by counting zeros to learn each length",
        "verify decoded numbers match the input",
        "done: bit stream round-trips back to inputs",
    ],
};

export default module;
