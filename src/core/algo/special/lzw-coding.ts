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
            codeLineNumber: line,
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
    id: "lzw-coding",
    name: "LZW Coding",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "abababa" },
    visualType: "text",
    run,
};

export default module;
