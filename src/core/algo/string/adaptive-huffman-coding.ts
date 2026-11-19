/**
 * adaptive-huffman-coding.ts - Adaptive Huffman Coding
 *
 * Unlike a static Huffman code, an adaptive coder updates its frequency model
 * after every symbol so the encoder and decoder stay in step without sending a
 * codebook. This implementation rebuilds a canonical Huffman code from the
 * current counts before each symbol: both sides begin with the same alphabet
 * and count of one per symbol, emit or consume one codeword, then increment the
 * count for that symbol and rebuild. The result is a prefix code at every step
 * and a bitstream that decodes back to the original text.
 *
 *  Time:  O(n^2 * alphabet) for n symbols with rebuilds
 *  Space: O(alphabet + total bits)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TreeNode {
    weight: number;
    label: string;
    symbol?: string;
    left?: TreeNode;
    right?: TreeNode;
}

/** Build a deterministic Huffman codebook from a symbol-count map. */
function buildCodebook(counts: Map<string, number>): Map<string, string> {
    const nodes: TreeNode[] = [...counts.entries()].map(([symbol, weight]) => ({
        weight,
        label: `L${symbol}`,
        symbol,
    }));
    let counter = 0;
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.weight - b.weight || a.label.localeCompare(b.label));
        const first = nodes.shift() as TreeNode;
        const second = nodes.shift() as TreeNode;
        nodes.push({
            weight: first.weight + second.weight,
            label: `I${counter++}`,
            left: first,
            right: second,
        });
    }
    const codes = new Map<string, string>();
    const walk = (node: TreeNode | undefined, prefix: string): void => {
        if (node === undefined) {
            return;
        }
        if (node.symbol !== undefined) {
            codes.set(node.symbol, prefix || "0");
            return;
        }
        walk(node.left, prefix + "0");
        walk(node.right, prefix + "1");
    };
    walk(nodes[0], "");
    return codes;
}

/** True when no codeword is a prefix of another. */
function isPrefixFree(codes: Map<string, string>): boolean {
    const all = [...codes.values()];
    for (let i = 0; i < all.length; i += 1) {
        for (let j = 0; j < all.length; j += 1) {
            if (i !== j && (all[j] as string).startsWith(all[i] as string)) {
                return false;
            }
        }
    }
    return true;
}

/** Decode one symbol from a bitstream using the current codebook. */
function decodeSymbol(bits: string, position: number, codes: Map<string, string>): { symbol: string; next: number } {
    const trie: Record<string, unknown> = {};
    for (const [symbol, code] of codes) {
        let node = trie as Record<string, unknown>;
        for (const bit of code) {
            node[bit] = node[bit] ?? {};
            node = node[bit] as Record<string, unknown>;
        }
        node.leaf = symbol;
    }
    let node = trie as Record<string, unknown>;
    let cursor = position;
    while (cursor < bits.length) {
        node = node[bits[cursor] as string] as Record<string, unknown>;
        cursor += 1;
        if (node === undefined) {
            break;
        }
        if (typeof node.leaf === "string") {
            return { symbol: node.leaf, next: cursor };
        }
    }
    return { symbol: "", next: cursor };
}

function textEntities(text: string, current: number, codes: Map<string, string>): VisualEntity[] {
    return [...text].map((ch, index) => ({
        id: `ch-${index}`,
        type: "character" as const,
        label: `${ch}:${codes.get(ch) ?? ""}`,
        value: ch,
        state: (index < current ? "sorted" : index === current ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, char: ch, code: codes.get(ch) ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { text?: string } | null) ?? {};
    const text = typeof cfg.text === "string" && cfg.text.length > 0 ? cfg.text.slice(0, 40) : "abracadabra";
    const alphabet = [...new Set(text.split(""))].sort();

    const encCounts = new Map<string, number>(alphabet.map((ch) => [ch, 1]));
    const decCounts = new Map<string, number>(alphabet.map((ch) => [ch, 1]));
    let encCodes = buildCodebook(encCounts);
    let decCodes = buildCodebook(decCounts);
    let bits = "";
    let decoded = "";
    let decPosition = 0;
    let allPrefixFree = true;
    let step = 0;
    const lines = 6;
    const F = (entities: VisualEntity[], description: string, line: number, extra: Record<string, number | string | boolean> = {}): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "text",
        meta: {
            text,
            alphabet: alphabet.join(""),
            bits,
            roundTrip: decoded === text,
            totalBits: bits.length,
            prefixFree: allPrefixFree,
            codeCount: encCodes.size,
            ...extra,
        },
    });

    yield F(textEntities(text, -1, encCodes), `Adaptive Huffman coding of "${text}" over ${alphabet.length} symbols.`, 0);
    step += 1;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        const code = encCodes.get(ch) ?? "";
        if (!isPrefixFree(encCodes)) {
            allPrefixFree = false;
        }
        bits += code;

        const decodedWord = decodeSymbol(bits, decPosition, decCodes);
        decPosition = decodedWord.next;
        decoded += decodedWord.symbol;

        encCounts.set(ch, (encCounts.get(ch) ?? 0) + 1);
        decCounts.set(decodedWord.symbol || ch, (decCounts.get(decodedWord.symbol || ch) ?? 0) + 1);
        encCodes = buildCodebook(encCounts);
        decCodes = buildCodebook(decCounts);

        yield F(
            textEntities(text, i, encCodes),
            `Symbol ${i + 1} "${ch}" emitted "${code}"; a prefix-free code of ${encCodes.size} symbols is rebuilt from the new counts.`,
            i + 1 <= 3 ? 1 : 2,
            { symbol: ch, code, stepBits: code.length },
        );
        step += 1;
    }

    yield F(textEntities(text, -1, encCodes), `Decoded "${decoded}" from ${bits.length} bits (match: ${decoded === text}); prefix-free at every step: ${allPrefixFree}.`, 4);
}

const module: AlgorithmModule = {
    education: {
        intuition: "A static Huffman code needs the whole frequency table before it starts. An adaptive coder does not: it starts with one count for every possible symbol, emits each symbol with the current code, then bumps that symbol's count and rebuilds the code. The decoder repeats the same updates, so it always holds the same codebook. Frequently repeated symbols quickly earn short codes, and no codebook has to be transmitted.",
        invariants: [
            "The encoder and decoder count maps are identical after every processed symbol.",
            "The codebook is prefix-free at every step, so each codeword parses uniquely.",
            "The number of bits consumed by the decoder equals the number emitted.",
        ],
        correctness: "Both sides start from the same alphabet with count one and apply the same rebuild rule, so induction gives identical codebooks before each symbol. Because a Huffman tree assigns one root-to-leaf path per symbol, no codeword prefixes another, so the decoder parsing the emitted bits from the current trie recovers exactly the symbol the encoder just wrote. After both increment the same count, the induction continues, so the full stream decodes to the original text.",
        complexityRationale: "Rebuilding a Huffman tree sorts and merges the alphabet symbols, costing O(alphabet log alphabet), once per input symbol, so the total is O(n * alphabet log alphabet). Storing the emitted bits uses space proportional to the total number of bits, plus one count per symbol.",
        uses: [
            "Streaming compression where the source statistics are unknown in advance",
            "The model-maintenance core of adaptive arithmetic and range coders",
            "Teaching the sibling-property and online coding concepts",
        ],
        references: [
            "Faller, Adaptive Huffman Coding, 1973 (and Knuth, 1977)",
            "Cover and Thomas, Elements of Information Theory, Chapter 5 (Huffman coding)",
        ],
        workedExample: "For the text 'aab' the alphabet is a,b with initial counts 1,1, giving codes a=0, b=1. After two a's the counts are 3,1, so a keeps the short code. Encoding emits 0, 0, then the rebuilt code for b, and the decoder reproduces aab by following the same rebuild schedule.",
    },
    id: "adaptive-huffman-coding",
    name: "Adaptive Huffman Coding",
    category: "string",
    complexity: { time: "O(n * alphabet log alphabet)", space: "O(alphabet + total bits)" },
    defaultInput: { text: "abracadabra" },
    visualType: "text",
    run,
    pseudocode: [
        "start encoder and decoder counts at one for every alphabet symbol",
        "build the current Huffman code from the encoder counts",
        "emit the current code for a symbol and append it to the bit stream",
        "decode one symbol from the stream with the decoder's current code",
        "increment that symbol's count on both sides and rebuild both codes",
        "report the decoded text and verify the round trip",
    ],
};

export default module;
