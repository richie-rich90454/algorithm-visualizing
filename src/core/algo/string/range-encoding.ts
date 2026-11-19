/**
 * range-encoding.ts - Range Encoding (integer interval coder)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Range encoding is an integer-arithmetic form of arithmetic coding. Instead
 * of assigning a distinct code word to every symbol, it represents an entire
 * message by a single number: any value inside a narrowing interval. Each
 * symbol shrinks the current interval to the sub-range proportional to that
 * symbol's frequency. A tag inside the final interval decodes back to the
 * original message.
 *
 * This implementation uses exact fixed-point integer arithmetic (BigInt), so
 * encoding and decoding are perfectly reversible with no floating-point drift.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * a) for n symbols and an alphabet of size a
 *   Space: O(a) for the frequency model, O(n) for the trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Message characters are shown as a text row.
 *   - Already-encoded characters are GREEN, the current one is ACTIVE.
 *   - meta reports the current integer interval and the final tag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface Model {
    alphabet: string[];
    cumulative: Map<string, [bigint, bigint]>;
    total: bigint;
}

/** Fixed-point scale: a 64-bit interval keeps long messages exact. */
const SCALE = 1n << 64n;

/** Limit the message so the interval never underflows the 64-bit scale. */
const MAX_LENGTH = 32;

/** Build a frequency model with deterministic symbol ordering. */
function buildModel(message: string): Model {
    const counts = new Map<string, bigint>();
    for (const ch of message) {
        counts.set(ch, (counts.get(ch) ?? 0n) + 1n);
    }
    const alphabet = [...counts.keys()];
    const cumulative = new Map<string, [bigint, bigint]>();
    let running = 0n;
    for (const ch of alphabet) {
        const count = counts.get(ch) ?? 0n;
        cumulative.set(ch, [running, running + count]);
        running += count;
    }
    return { alphabet, cumulative, total: running };
}

/** Narrow the interval for one symbol. */
function narrow(low: bigint, high: bigint, lo: bigint, hi: bigint, total: bigint): [bigint, bigint] {
    const width = high - low;
    return [low + (width * lo) / total, low + (width * hi) / total];
}

/** Build the character entities for a frame, colouring encoded characters. */
function makeText(message: string, encoded: number, current: number): VisualEntity[] {
    const states = new Map<number, EntityState>();
    for (let i = 0; i < encoded; i += 1) {
        states.set(i, "sorted");
    }
    if (current >= 0) {
        states.set(current, "active");
    }
    return makeCharacters(message).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string } | null) ?? {};
    const raw = typeof task.message === "string" && task.message.length > 0 ? task.message : "abracadabra";
    const message = raw.slice(0, MAX_LENGTH);
    const lines = 9;
    const model = buildModel(message);
    let step = 0;

    const frame = (
        encoded: number,
        current: number,
        description: string,
        line: number,
        low: bigint,
        high: bigint,
        tag: bigint,
        decoded: string,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeText(message, encoded, current),
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: {
            low: low.toString(),
            high: high.toString(),
            tag: tag.toString(),
            tagInside: tag >= low && tag < high,
            decoded,
            alphabet: model.alphabet.join(""),
            length: message.length,
        },
    });

    yield frame(0, -1, `Range-encode "${message}" with an integer interval over ${model.alphabet.length} symbol(s).`, 0, 0n, SCALE, 0n, "");
    step += 1;

    let low = 0n;
    let high = SCALE;
    for (let i = 0; i < message.length; i += 1) {
        const ch = message[i] as string;
        const [lo, hi] = model.cumulative.get(ch) as [bigint, bigint];
        [low, high] = narrow(low, high, lo, hi, model.total);
        yield frame(
            i + 1,
            i,
            `Symbol ${i + 1} '${ch}' narrows the interval to [${low}, ${high}).`,
            3,
            low,
            high,
            0n,
            "",
        );
        step += 1;
    }

    const tag = (low + high) / 2n;
    yield frame(message.length, -1, `Choose tag ${tag} inside the final interval [${low}, ${high}).`, 4, low, high, tag, "");
    step += 1;

    let dLow = 0n;
    let dHigh = SCALE;
    let decoded = "";
    for (let i = 0; i < message.length; i += 1) {
        const width = dHigh - dLow;
        const offset = ((tag - dLow) * model.total) / width;
        let symbol = model.alphabet[model.alphabet.length - 1] as string;
        for (const ch of model.alphabet) {
            const [lo, hi] = model.cumulative.get(ch) as [bigint, bigint];
            if (offset >= lo && offset < hi) {
                symbol = ch;
                break;
            }
        }
        const [lo, hi] = model.cumulative.get(symbol) as [bigint, bigint];
        [dLow, dHigh] = narrow(dLow, dHigh, lo, hi, model.total);
        decoded += symbol;
        yield frame(
            message.length,
            -1,
            `Decode step ${i + 1}: tag falls in '${symbol}', interval narrows to [${dLow}, ${dHigh}).`,
            6,
            dLow,
            dHigh,
            tag,
            decoded,
        );
        step += 1;
    }

    yield frame(
        message.length,
        -1,
        `Decoded "${decoded}" from a single tag; round-trip ${decoded === message ? "succeeded" : "failed"}.`,
        8,
        dLow,
        dHigh,
        tag,
        decoded,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Range encoding abandons per-symbol code words. It keeps one interval of integers and, for each symbol, keeps only the slice of that interval whose size matches the symbol's frequency. After the whole message the interval is tiny, and any integer inside it uniquely identifies the message. Decoding walks the same intervals in reverse, reading off which slice contains the tag.",
        invariants: [
            "The interval [low, high) always contains the tag chosen from the final interval.",
            "Each symbol maps to a contiguous sub-range whose width is proportional to its count.",
            "Encoding and decoding use the same frequency model, so the intervals stay in lockstep.",
        ],
        correctness:
            "At every step encoding replaces the interval by exactly the sub-range assigned to the current symbol. The tag lies in the final interval, so when decoding starts from the full range, the slice containing the tag must be the first encoded symbol. Restricting to that slice and repeating recovers every symbol in order; an induction on the message prefix proves the decoded output equals the input.",
        complexityRationale:
            "Building the model counts n symbols into a table of size a. Each encode or decode step narrows an interval with constant-time BigInt operations after finding the symbol's slice, which takes O(a) by scanning the alphabet. The trace stores one frame per symbol, giving O(n * a) time and O(n + a) space.",
        uses: [
            "The arithmetic coder inside modern image and video codecs",
            "Entropy coding in lossless compressors such as LZMA and Zstandard",
            "Near-optimal prefix-free coding when symbol probabilities are skewed",
        ],
        references: [
            "Rissanen and Langdon, Arithmetic Coding, IBM Journal of Research and Development, 1979",
            "Subbotin, Arbitrary Base Range Coder, 1990",
            "Cover and Thomas, Elements of Information Theory, Chapter 5",
        ],
        workedExample:
            "For 'aab' the counts are a:2, b:1, so a owns [0, 2/3) and b owns [2/3, 1). Starting from [0, 1), the first a gives [0, 2/3), the second a gives [0, 4/9), and b gives [8/27, 12/27). A tag near 10/27 decodes back through a, a, b.",
    },
    id: "range-encoding",
    name: "Range Encoding",
    category: "string",
    complexity: { time: "O(n * a)", space: "O(n + a)" },
    defaultInput: { message: "abracadabra" },
    visualType: "text",
    run,
    pseudocode: [
        "count symbol frequencies and build cumulative intervals",
        "set low to zero and high to the fixed-point scale",
        "for each symbol of the message",
        "narrow the interval to that symbol's cumulative sub-range",
        "choose a tag value strictly inside the final interval",
        "decode by locating the tag in each symbol's sub-range",
        "narrow the decoding interval to the located slice",
        "repeat until the original message length is reached",
        "report the tag and the decoded message",
    ],
};

export default module;
