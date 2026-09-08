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
            codeLineNumber: line,
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
    id: "lz77-coding",
    name: "LZ77 Coding",
    category: "string",
    complexity: { time: "O(n·w)", space: "O(n)" },
    defaultInput: { text: "abcababcab", window: 6 },
    visualType: "text",
    run,
};

export default module;
