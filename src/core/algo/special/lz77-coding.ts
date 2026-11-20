/**
 * lz77-coding.ts – LZ77 sliding-window coding.
 * "abcababcab" with window 6 becomes (offset,length,next) triples:
 * repeats point back into the window instead of restating text.
 * Decoding replays the triples; round-trip is verified, not assumed.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Tok {
    off: number;
    len: number;
    next: string;
}

function encode(text: string, W: number): Tok[] {
    const toks: Tok[] = [];
    let i = 0;
    while (i < text.length) {
        let best = { off: 0, len: 0 };
        for (let j = Math.max(0, i - W); j < i; j += 1) {
            let len = 0;
            while (text[j + len] === text[i + len] && i + len < text.length) len += 1;
            if (len > best.len) best = { off: i - j, len };
        }
        toks.push({ off: best.off, len: best.len, next: text[i + best.len] ?? "" });
        i += best.len + 1;
    }
    return toks;
}

function decode(toks: Tok[]): string {
    let out = "";
    for (const t of toks) {
        for (let k = 0; k < t.len; k += 1) out += out[out.length - t.off] ?? "";
        out += t.next;
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { text?: string; window?: number } | null) ?? {};
    const text =
        typeof cfg.text === "string" && cfg.text.length > 0 ? cfg.text.slice(0, 14) : "abcababcab";
    const toks = encode(text, 6);
    const roundTrip = decode(toks) === text;
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
            meta: {
                tokens: toks.slice(0, line).map((t) => `(${t.off},${t.len},${t.next || "∅"})`),
                roundTrip,
            },
        };
    };
    yield frame(`LZ77: window=6 over "${text}" — longest back-match wins.`, 0);
    step += 1;
    for (let t = 0; t < toks.length && step < 13; t += 1) {
        const tok = toks[t] as Tok;
        consumed += tok.len + 1;
        yield frame(
            `Token (${tok.off},${tok.len},${tok.next || "∅"}): copy ${tok.len} from ${tok.off} back, then "${tok.next || "end"}".`,
            t + 1,
        );
        step += 1;
    }
    yield frame(
        `Done: ${toks.length} triples, decode matches input: ${roundTrip}.`,
        toks.length + 1,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "LZ77 compresses by replacing repeated substrings with back-references into a sliding window of recently seen text. At each position it finds the longest match in the window and emits a triple of offset, length and the next character instead of the literal text. Decoding replays the triples, copying each match from already reconstructed output.",
        "invariants": [
            "The offset always points into the already-decoded prefix, within the window size.",
            "A triple plus its matched length consumes exactly that much input text.",
            "Decoding the emitted triples reproduces the original string exactly."
        ],
        "correctness": "Every back-reference points into the already-decoded output, so the decoder can reconstruct each copied substring deterministically, and the trailing next character advances the stream. By induction over the triples, the decoded output equals the input, which the demo verifies with a round trip.",
        "complexityRationale": "For each of n positions the encoder scans up to w window offsets and compares up to w characters, O(n·w) time. The token list holds at most n triples, O(n) space.",
        "uses": [
            "DEFLATE used by gzip, ZIP and PNG, combined with Huffman coding",
            "The LZ4 and Snappy fast compressor family",
            "Network and storage compression protocols",
            "Archival formats and match-finding in LZMA"
        ],
        "references": [
            "Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, IEEE Transactions on Information Theory, 1977",
            "Ziv and Lempel, Compression of Individual Sequences via Variable-Rate Coding, 1978"
        ],
        "workedExample": "For \"abcababcab\" with window 6, the first three characters have no history and emit (0,0,'a'), (0,0,'b'), (0,0,'c'). At position 3 the substring \"ab\" matches 3 characters back, giving (3,2,'a'). At position 6 a longer match gives (3,3,'b'). Replaying the five triples reconstructs the text."
    },
    id: "lz77-coding",
    name: "LZ77 Coding",
    category: "string",
    complexity: { time: "O(n·w)", space: "O(n)" },
    defaultInput: { text: "abcababcab", window: 6 },
    visualType: "text",
    run,
    pseudocode: [
        "initialize sliding window of size 6 over text",
        "scan text left to right tracking consumed prefix",
        "find longest back-match inside the window",
        "emit triple (offset, length, next char)",
        "advance consumed pointer past the match",
        "decode triples by copying from history",
        "done: triple count with verified round-trip",
    ],
};

export default module;
