/**
 * lz78-coding.ts – LZ78 dictionary coding.
 * "abababa" grows an explicit phrase dictionary: each phrase is
 * (code-of-prefix, new char). Decoding replays the phrases;
 * round-trip is verified, not assumed.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function encode(text: string): { pairs: Array<[number, string]>; lens: number[] } {
    const dict = new Map<string, number>();
    const pairs: Array<[number, string]> = [];
    const lens: number[] = [];
    let next = 1;
    let i = 0;
    while (i < text.length) {
        let w = "";
        while (i + w.length < text.length && dict.has(w + (text[i + w.length] ?? "")))
            w += text[i + w.length] ?? "";
        const ch = text[i + w.length] ?? "";
        pairs.push([w === "" ? 0 : (dict.get(w) ?? 0), ch]);
        lens.push(w.length + 1);
        dict.set(w + ch, next);
        next += 1;
        i += w.length + 1;
    }
    return { pairs, lens };
}

function decode(pairs: Array<[number, string]>): string {
    const dict = new Map<number, string>();
    let out = "";
    let next = 1;
    for (const [code, ch] of pairs) {
        const w = (code === 0 ? "" : (dict.get(code) ?? "")) + ch;
        out += w;
        dict.set(next, w);
        next += 1;
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { text?: string } | null) ?? {};
    const text =
        typeof cfg.text === "string" && cfg.text.length > 0 ? cfg.text.slice(0, 14) : "abababa";
    const { pairs, lens } = encode(text);
    const roundTrip = decode(pairs) === text;
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
            meta: { phrases: pairs.slice(0, line).map(([c, ch]) => `(${c},${ch})`), roundTrip },
        };
    };
    yield frame(`LZ78: dictionary starts empty over "${text}".`, 0);
    step += 1;
    for (let t = 0; t < pairs.length && step < 13; t += 1) {
        const [code, ch] = pairs[t] as [number, string];
        consumed += lens[t] ?? 1;
        yield frame(
            `Phrase ${t + 1}=(${code},${ch}): longest known prefix ${code} plus new char.`,
            t + 1,
        );
        step += 1;
    }
    yield frame(
        `Done: ${pairs.length} phrases, decode matches input: ${roundTrip}.`,
        pairs.length + 1,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "LZ78 builds an explicit dictionary of phrases as it scans text. At each step it finds the longest already-known prefix, emits a pair of that prefix's code and the next character, and adds the new phrase to the dictionary. Decoding replays the same dictionary construction, so the phrases themselves never need to be transmitted.",
        "invariants": [
            "Encoder and decoder build identical dictionaries because each new phrase is the prior prefix plus the emitted character.",
            "Dictionary codes are assigned in increasing order from 1, with 0 denoting the empty prefix.",
            "Each emitted pair consumes at least one new input character."
        ],
        "correctness": "The decoder creates each dictionary entry at the same step the encoder used it, so every code the encoder emits is already defined when read. By induction the decoder's phrase for each code matches the encoder's, and concatenating them reproduces the input, which the demo checks with a round trip.",
        "complexityRationale": "At each of the n positions the encoder searches the dictionary for the longest prefix; with a naive map lookup over growing phrases this is O(n^2) in the worst case. The dictionary stores at most n phrases, O(n) space.",
        "uses": [
            "The foundation of LZW used in GIF and TIFF",
            "The Unix compress utility and its descendants",
            "Dictionary-based text compression",
            "Incremental parsing in string algorithms and data deduplication concepts"
        ],
        "references": [
            "Ziv and Lempel, Compression of Individual Sequences via Variable-Rate Coding, IEEE Transactions on Information Theory, 1978",
            "Bell, Witten and Cleary, Text Compression, Chapter 4"
        ],
        "workedExample": "For \"abababa\", the dictionary starts empty. Step 1 emits (0,'a') and adds \"a\"=1. Step 2 finds prefix \"a\" and emits (1,'b'), adding \"ab\"=2. Step 3 finds prefix \"ab\" and emits (2,'a'), adding \"aba\"=3. Replaying the pairs rebuilds the dictionary and the string \"abababa\"."
    },
    id: "lz78-coding",
    name: "LZ78 Coding",
    category: "string",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: { text: "abababa" },
    visualType: "text",
    run,
    pseudocode: [
        "initialize empty phrase dictionary over text",
        "scan text tracking consumed prefix length",
        "find longest known prefix plus next character",
        "emit pair (prefix code, new char)",
        "add the new phrase to the dictionary",
        "decode pairs by replaying dictionary growth",
        "done: phrase count with verified round-trip",
    ],
};

export default module;
