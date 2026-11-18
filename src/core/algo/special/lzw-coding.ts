/**
 * lzw-coding.ts – LZW dictionary coding.
 * "abababa" over {a,b}: each step emits the longest known phrase and
 * adds phrase+next-char to the dictionary. Decoding replays the codes;
 * round-trip is verified, not assumed.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function encode(text: string): { codes: number[]; lens: number[] } {
    const dict = new Map<string, number>();
    [...new Set(text)].forEach((ch, i) => dict.set(ch, i));
    let next = dict.size;
    const codes: number[] = [];
    const lens: number[] = [];
    let w = "";
    for (const ch of text) {
        if (dict.has(w + ch)) {
            w += ch;
            continue;
        }
        codes.push(dict.get(w) ?? 0);
        lens.push(w.length);
        dict.set(w + ch, next);
        next += 1;
        w = ch;
    }
    if (w !== "") {
        codes.push(dict.get(w) ?? 0);
        lens.push(w.length);
    }
    return { codes, lens };
}

function decode(codes: number[], alphabet: string[]): string {
    const dict = new Map<number, string>();
    alphabet.forEach((ch, i) => dict.set(i, ch));
    let next = alphabet.length;
    let prev = "";
    let out = "";
    for (const [k, c] of codes.map((c, k) => [k, c] as [number, number])) {
        void k;
        const entry = dict.has(c) ? (dict.get(c) ?? "") : prev + prev[0];
        out += entry;
        if (prev !== "") {
            dict.set(next, prev + (entry[0] ?? ""));
            next += 1;
        }
        prev = entry;
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { text?: string } | null) ?? {};
    const text =
        typeof cfg.text === "string" && cfg.text.length > 0 ? cfg.text.slice(0, 14) : "abababa";
    const { codes, lens } = encode(text);
    const roundTrip = decode(codes, [...new Set(text)]) === text;
    let step = 0;
    let consumed = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [...text].map((ch, i) => ({
            id: `ch-${i}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: (i < consumed
                ? "visited"
                : i === consumed
                  ? "comparing"
                  : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "text",
            meta: { codes: codes.slice(0, line), roundTrip },
        };
    };
    yield frame(`LZW: dictionary starts as {${[...new Set(text)].join(",")}} over "${text}".`, 0);
    step += 1;
    for (let t = 0; t < codes.length && step < 13; t += 1) {
        consumed += lens[t] ?? 1;
        yield frame(
            `Emit code ${codes[t]} for "${text.slice(consumed - (lens[t] ?? 1), consumed)}"; dictionary gains one phrase.`,
            t + 1,
        );
        step += 1;
    }
    yield frame(
        `Done: codes [${codes.join(",")}], decode matches input: ${roundTrip}.`,
        codes.length + 1,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "LZW is a variant of LZ78 that seeds the dictionary with every single character and emits numeric codes instead of prefix-and-character pairs. As it scans, it extends the current phrase while that phrase is in the dictionary, then emits its code and adds phrase plus next character. The decoder builds the same dictionary from the codes alone.",
        "invariants": [
            "The dictionary always holds all single characters plus one new phrase per emitted code.",
            "Encoder and decoder dictionaries stay synchronized because each new phrase is the previous phrase plus the first character of the current one.",
            "Codes grow monotonically from the alphabet size."
        ],
        "correctness": "The decoder reconstructs each dictionary entry one step before it is needed, with a special case when a code refers to the entry currently being created, so every emitted code is decodable. By induction the reconstructed phrases equal the encoder's, making the round trip exact as the demo verifies.",
        "complexityRationale": "Using a hash map, each scan step does constant-time lookups, so encoding and decoding are O(n) for n characters. The dictionary holds at most n entries; with bounded phrase length and a map, space is O(n).",
        "uses": [
            "GIF image compression",
            "TIFF and PDF image streams",
            "The Unix compress utility",
            "General dictionary-based lossless compression and hardware compressors"
        ],
        "references": [
            "Welch, A Technique for High-Performance Data Compression, IEEE Computer, 1984",
            "Ziv and Lempel, Compression of Individual Sequences via Variable-Rate Coding, 1978"
        ],
        "workedExample": "For \"abababa\" over {a,b}, dictionary a=0 and b=1. Scanning emits code 0 for 'a' and adds \"ab\"=2, emits 1 for 'b' and adds \"ba\"=3, emits 2 for \"ab\" and adds \"aba\"=4, then emits 4 for the final \"aba\". The codes [0,1,2,4] replay to \"abababa\"."
    },
    id: "lzw-coding",
    name: "LZW Coding",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "abababa" },
    visualType: "text",
    run,
    pseudocode: [
        "initialize dictionary with single characters found",
        "scan text tracking consumed prefix length",
        "emit code for longest known phrase present",
        "add phrase plus next char to dictionary",
        "advance consumed pointer by phrase length",
        "decode codes by replaying dictionary growth",
        "done: code list with verified round-trip",
    ],
};

export default module;
