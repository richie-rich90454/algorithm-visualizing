/**
 * adaptive-arithmetic-coding.ts - Adaptive Arithmetic Coding
 *
 * Instead of fixing a codebook in advance, an adaptive arithmetic coder keeps a
 * running frequency table that starts uniform and grows after every symbol. Each
 * symbol narrows the current interval in proportion to its predicted
 * probability, so frequently seen characters consume less of the number line.
 * Decoding replays the same interval updates to recover the message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(cells: Array<[string, string]>, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return cells.map(([label, value], index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value ? `${label}: ${value}` : label,
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 2), col: index % 2, index },
    }));
}

function encodeAdaptive(text: string, alphabet: string[]): { code: number; low: number; high: number } {
    const counts = new Map<string, number>(alphabet.map((s) => [s, 1]));
    let low = 0;
    let high = 1;
    for (const ch of text) {
        const total = alphabet.reduce((sum, s) => sum + counts.get(s)!, 0);
        let cumLow = 0;
        for (const s of alphabet) {
            if (s === ch) break;
            cumLow += counts.get(s)!;
        }
        const count = counts.get(ch)!;
        const span = high - low;
        const nextLow = low + (span * cumLow) / total;
        const nextHigh = low + (span * (cumLow + count)) / total;
        low = nextLow;
        high = nextHigh;
        counts.set(ch, count + 1);
    }
    return { code: (low + high) / 2, low, high };
}

function decodeAdaptive(code: number, length: number, alphabet: string[]): string {
    const counts = new Map<string, number>(alphabet.map((s) => [s, 1]));
    let low = 0;
    let high = 1;
    let out = "";
    for (let k = 0; k < length; k += 1) {
        const total = alphabet.reduce((sum, s) => sum + counts.get(s)!, 0);
        const target = (code - low) / (high - low);
        let cumulative = 0;
        let chosen = alphabet[alphabet.length - 1]!;
        for (const s of alphabet) {
            const upper = cumulative + counts.get(s)! / total;
            if (target < upper) {
                chosen = s;
                break;
            }
            cumulative = upper;
        }
        const count = counts.get(chosen)!;
        let before = 0;
        for (const s of alphabet) {
            if (s === chosen) break;
            before += counts.get(s)!;
        }
        const span = high - low;
        const nextLow = low + (span * before) / total;
        const nextHigh = low + (span * (before + count)) / total;
        low = nextLow;
        high = nextHigh;
        counts.set(chosen, count + 1);
        out += chosen;
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = typeof task.text === "string" ? task.text.slice(0, 12) : "abracadabra";
    const alphabet = [...new Set(text)].sort();
    const frames: VisualFrame[] = [];

    const push = (cells: Array<[string, string]>, desc: string, line: number, states?: Map<number, EntityState>, code = 0, decoded = ""): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(cells, states),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                text,
                decoded,
                code,
                alphabet,
                symbolCount: alphabet.length,
                bitEstimate: Math.ceil(-Math.log2(Math.max(1e-12, 1 / alphabet.length)) * text.length),
            },
        });
    };

    push([["message", text], ["alphabet", alphabet.join("")]], `Encoding "${text}" adaptively.`, 0);
    if (alphabet.length === 0) {
        push([["message", "empty"]], "Empty message - nothing to encode.", 5);
        for (const frame of frames) yield frame;
        return;
    }

    const counts = new Map<string, number>(alphabet.map((s) => [s, 1]));
    let low = 0;
    let high = 1;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i]!;
        const total = alphabet.reduce((sum, s) => sum + counts.get(s)!, 0);
        let cumLow = 0;
        for (const s of alphabet) {
            if (s === ch) break;
            cumLow += counts.get(s)!;
        }
        const count = counts.get(ch)!;
        const span = high - low;
        const nextLow = low + (span * cumLow) / total;
        const nextHigh = low + (span * (cumLow + count)) / total;
        low = nextLow;
        high = nextHigh;
        counts.set(ch, count + 1);
        push(
            [["symbol", ch], ["interval", `${low.toFixed(4)} .. ${high.toFixed(4)}`], ["width", (high - low).toFixed(4)], ["count", String(count + 1)]],
            `Symbol '${ch}' narrows the interval to width ${(high - low).toFixed(4)}.`,
            2,
            new Map([[0, "active"]]),
        );
    }

    const result = encodeAdaptive(text, alphabet);
    const decoded = decodeAdaptive(result.code, text.length, alphabet);
    push(
        [["code", result.code.toFixed(6)], ["decoded", decoded], ["symbols", String(alphabet.length)], ["match", decoded === text ? "yes" : "no"]],
        `Decoded interval midpoint back to "${decoded}".`,
        4,
        new Map([[3, decoded === text ? "sorted" : "error"]]),
        result.code,
        decoded,
    );

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeCells(
            [["code", result.code.toFixed(6)], ["decoded", decoded], ["symbols", String(alphabet.length)], ["match", decoded === text ? "yes" : "no"]],
            new Map([[3, decoded === text ? "sorted" : "error"]]),
        ),
        edges: [],
        description: `Done: adaptive arithmetic code ${result.code.toFixed(6)} decodes to the original message.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { text, decoded, code: result.code, alphabet, symbolCount: alphabet.length, bitEstimate: Math.ceil(-Math.log2(1 / alphabet.length) * text.length) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Arithmetic coding represents a whole message as one fraction inside an interval. Adaptive arithmetic coding updates the probability model after each symbol, so a character that has appeared often recently gets a larger share of the interval and costs fewer bits.",
        invariants: [
            "The interval always lies inside the previous interval and never has zero width.",
            "Every symbol's subinterval is proportional to its current frequency count.",
            "Encoder and decoder apply identical count updates, so their intervals stay in sync.",
        ],
        correctness:
            "Each symbol maps the current interval onto a disjoint subinterval whose width equals its predicted probability. The midpoint of the final interval lies inside every prefix interval, so decoding can recover each symbol by locating the code within the current partition. Because the decoder uses the same frequency updates, it follows the identical sequence of partitions and reconstructs the original message exactly.",
        complexityRationale:
            "Encoding and decoding each process n symbols, and finding a symbol's cumulative count is O(k) for an alphabet of k symbols, so the teaching implementation runs in O(n*k) time with O(k) space for the frequency table.",
        uses: [
            "Compression in JPEG and arithmetic-coded video standards",
            "Entropy coding in text and image compressors",
            "Teaching online probability estimation and entropy coding",
        ],
        references: [
            "Rissanen and Langdon, Arithmetic Coding, IBM Journal of Research and Development, 1979",
            "Cover and Thomas, Elements of Information Theory, chapter on arithmetic codes",
        ],
        workedExample:
            "For the message aba with alphabet {a, b}, counts start at one each. The first a picks the lower half of [0,1), b picks a subinterval of the upper half, and the final a narrows again. The midpoint of the resulting interval decodes back to aba.",
    },
    id: "adaptive-arithmetic-coding",
    name: "Adaptive Arithmetic Coding",
    category: "string",
    complexity: { time: "O(n*k)", space: "O(k)" },
    defaultInput: { text: "abracadabra" },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the message alphabet and start every count at one",
        "initialize the interval to [0, 1)",
        "for each symbol, split the interval by cumulative frequencies",
        "narrow the interval to the symbol's share",
        "increase that symbol's count by one",
        "encode with the interval midpoint and decode by replaying the splits",
        "done: report the code and the recovered message",
    ],
};

export default module;
