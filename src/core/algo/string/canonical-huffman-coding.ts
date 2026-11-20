/**
 * canonical-huffman-coding.ts - Canonical Huffman Coding
 *
 * After building an ordinary Huffman tree, canonical coding throws away the
 * tree shape and assigns codewords by length: symbols are sorted by code length
 * (then alphabetically) and receive consecutive binary numbers of their length.
 * Decoders can therefore rebuild the codebook from a compact list of lengths.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Node {
    sym?: string;
    freq: number;
    left?: Node;
    right?: Node;
    id: number;
}

function makeCells(rows: number, cols: number, cells: Array<[string, string]>, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let k = 0; k < rows * cols; k += 1) {
        const [label, value] = cells[k] ?? ["", ""];
        out.push({
            id: `cell-${k}`,
            type: "cell" as const,
            label: value ? `${label}: ${value}` : label,
            value,
            state: states.get(k) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(k / cols), col: k % cols, index: k },
        });
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "abracadabra";
    const frames: VisualFrame[] = [];
    const codes: Record<string, string> = {};
    const rows = 4;
    const cols = 4;

    const push = (cells: Array<[string, string]>, desc: string, line: number, states?: Map<number, EntityState>, encoded = ""): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(rows, cols, cells, states),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                codes: { ...codes },
                encoded,
                totalBits: encoded.length,
                symbolCount: Object.keys(codes).length,
                text,
                rows,
                cols,
            },
        });
    };

    const freq = new Map<string, number>();
    for (const ch of text) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    const alphabet = [...freq.keys()].sort();
    push(
        alphabet.map((s) => [s, String(freq.get(s))]),
        `Counting frequencies for ${text.length} character(s).`,
        0,
    );

    if (alphabet.length === 0) {
        push([["", "empty input"]], "Empty input - no codes to assign.", 5);
        for (const frame of frames) yield frame;
        return;
    }

    let nextId = 0;
    let nodes: Node[] = alphabet.map((s) => ({ sym: s, freq: freq.get(s)!, id: nextId++ }));
    if (nodes.length === 1) {
        const only = nodes[0]!;
        codes[only.sym!] = "0";
        push([[only.sym!, "0"]], "Single symbol - assigned code 0.", 4, new Map([[0, "sorted"]]));
    } else {
        while (nodes.length > 1) {
            nodes.sort((a, b) => a.freq - b.freq || a.id - b.id);
            const x = nodes.shift()!;
            const y = nodes.shift()!;
            const merged: Node = { freq: x.freq + y.freq, left: x, right: y, id: nextId++ };
            nodes.push(merged);
            push(
                nodes.slice(0, rows * cols).map((n) => [n.sym ?? `*${n.id}`, String(n.freq)]),
                `Merging the two least frequent nodes into weight ${merged.freq}.`,
                2,
            );
        }
        const lengths = new Map<string, number>();
        const walk = (node: Node, depth: number): void => {
            if (node.sym !== undefined) lengths.set(node.sym, Math.max(1, depth));
            else {
                walk(node.left!, depth + 1);
                walk(node.right!, depth + 1);
            }
        };
        walk(nodes[0]!, 0);
        const ordered = [...lengths.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
        let code = 0;
        let prevLen = 0;
        for (const [sym, len] of ordered) {
            if (len > prevLen) code <<= len - prevLen;
            codes[sym] = code.toString(2).padStart(len, "0");
            code += 1;
            prevLen = len;
        }
        push(
            ordered.map(([s, len]) => [s, `${len} ${codes[s]}`]),
            "Assigned canonical codes sorted by length then symbol.",
            4,
            new Map(ordered.map((_, k) => [k, "sorted" as EntityState])),
        );
    }

    let encoded = "";
    for (const ch of text) encoded += codes[ch];
    push(
        [["bit string", encoded.slice(0, rows * cols * 6)], ["bits", String(encoded.length)], ["symbols", String(Object.keys(codes).length)], ["avg", (encoded.length / Math.max(1, text.length)).toFixed(2)]],
        `Encoded message uses ${encoded.length} bit(s).`,
        5,
        new Map([[0, "sorted"]]),
        encoded,
    );

    for (const frame of frames) yield frame;
    const last = frames[frames.length - 1]!;
    yield {
        stepNumber: frames.length,
        entities: makeCells(rows, cols, [["bit string", (last.meta.encoded as string).slice(0, 60)], ["bits", String(last.meta.totalBits)], ["symbols", String(last.meta.symbolCount)], ["done", "canonical"]], new Map([[3, "sorted"]])),
        edges: [],
        description: `Done: canonical Huffman code with ${Object.keys(codes).length} symbol(s) and ${encoded.length} bit(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { codes: { ...codes }, encoded, totalBits: encoded.length, symbolCount: Object.keys(codes).length, text, rows, cols },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Huffman coding gives each symbol a codeword whose length reflects its frequency. Canonical coding then renormalizes the tree into a simple rule: list symbols by length, then hand out consecutive binary numbers. The codes are just as good but need only the lengths to be stored.",
        invariants: [
            "No codeword is a prefix of another, so decoding is unambiguous.",
            "Code lengths match the depths of the corresponding Huffman leaves.",
            "Codes are assigned in lexicographic order within each length group.",
        ],
        correctness:
            "Huffman's greedy merge of the two least frequent nodes minimizes the weighted path length. Replacing each leaf's code by a canonical number of the same length preserves the prefix-free property because codes of equal length are distinct and longer codes only begin after the block of shorter codes. Hence the canonical code has the same optimal cost.",
        complexityRationale:
            "Building the tree with repeated minimum selection takes O(k^2) for k symbols, canonical assignment is O(k log k), and encoding is O(n) for a message of length n.",
        uses: [
            "Compact codebooks in DEFLATE and other compressed formats",
            "Prefix codes for network protocols and barcode symbologies",
            "Teaching canonical prefix codes and decoders",
        ],
        references: [
            "Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952",
            "Cover and Thomas, Elements of Information Theory, chapter on optimal codes",
        ],
        workedExample:
            "For aab, weights are a=2 and b=1 and both leaves sit at depth one. Canonical assignment gives a -> 0 and b -> 1, so aab encodes as 001, which is three bits.",
    },
    id: "canonical-huffman-coding",
    name: "Canonical Huffman Coding",
    category: "string",
    complexity: { time: "O(k^2 + n)", space: "O(k)" },
    defaultInput: { text: "abracadabra" },
    visualType: "grid",
    run,
    pseudocode: [
        "count the frequency of every symbol",
        "repeatedly merge the two least frequent nodes into a Huffman tree",
        "record each symbol's code length from its leaf depth",
        "sort symbols by length and then alphabetically",
        "give each symbol the next binary number of its length",
        "concatenate the codes to encode the message",
        "done: report the canonical codebook and bit string",
    ],
};

export default module;
