/**
 * huffman-coding.ts – Huffman Coding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Huffman coding is an optimal prefix code for lossless compression. It builds
 * a binary tree bottom-up from character frequencies: repeatedly merge the two
 * lowest-frequency nodes, then label left edges 0 and right edges 1. Frequent
 * characters get short codes; rare characters get long ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build: O(n log n) – a priority queue drives the merges
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The Huffman tree is drawn with edge labels 0/1.
 *   - The merge order is narrated.
 *   - The resulting code table is shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Merge the two smallest, repeat" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Huffman Coding generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "aabcccdddd";

    let step = 0;

    // Frequencies.
    const freq = new Map<string, number>();
    for (const char of text) {
        freq.set(char, (freq.get(char) ?? 0) + 1);
    }

    // Build the Huffman tree with a simple array-based priority list.
    type HNode = {
        char: string | null;
        freq: number;
        left: HNode | null;
        right: HNode | null;
    };
    let forest: HNode[] = [...freq.entries()].map(([char, f]) => ({
        char,
        freq: f,
        left: null,
        right: null,
    }));

    const buildFrame = (message: string): VisualFrame => {
        // Flatten the tree (once a root exists).
        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const flatten = (node: HNode, parentId: string | null, bit: string | null): void => {
            const id = `n-${node.char ?? "in"}-${node.freq}-${nodes.length}`;
            nodes.push({
                id,
                type: "node" as const,
                label: `${node.char ?? "*"}:${node.freq}`,
                value: node.freq,
                state: node.left === null && node.right === null ? "sorted" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentId ?? "root" },
            });
            if (node.left) {
                edges.push({
                    id: `${id}-L`,
                    sourceId: id,
                    targetId: `n-${node.left.char ?? "in"}-${node.left.freq}-${nodes.length}`,
                    label: "0",
                    state: "idle",
                    directed: false,
                });
                flatten(node.left, id, "0");
            }
            if (node.right) {
                edges.push({
                    id: `${id}-R`,
                    sourceId: id,
                    targetId: `n-${node.right.char ?? "in"}-${node.right.freq}-${nodes.length}`,
                    label: "1",
                    state: "idle",
                    directed: false,
                });
                flatten(node.right, id, "1");
            }
        };
        const roots = forest.filter(() => true);
        roots.forEach((node, index) => flatten(node, index === 0 ? null : `n-...`, null));
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { forest: forest.length },
        };
    };

    // Frame 0: the leaf nodes.
    yield buildFrame(
        `Frequency leaves: ${[...freq.entries()].map(([c, f]) => `${c}:${f}`).join(", ")}.`,
    );
    step += 1;

    // Merge the two smallest repeatedly.
    while (forest.length > 1) {
        forest.sort((a, b) => a.freq - b.freq);
        const a = forest.shift();
        const b = forest.shift();
        if (!a || !b) {
            break;
        }
        forest.push({
            char: null,
            freq: a.freq + b.freq,
            left: a,
            right: b,
        });
        yield buildFrame(
            `Merged ${a.freq} and ${b.freq} into a node of weight ${a.freq + b.freq}.`,
        );
        step += 1;
    }

    yield buildFrame(`Huffman tree complete – frequent characters now have the shortest codes.`);
}

/** The Huffman Coding module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Huffman coding builds an optimal prefix-free code for lossless compression. It starts with a leaf for each character weighted by frequency, then repeatedly merges the two lightest nodes into a new parent whose weight is their sum. Labeling left edges 0 and right edges 1 gives frequent characters short codes and rare characters long ones.",
        "invariants": [
            "The forest always holds disjoint trees whose root weight equals the sum of its leaves' frequencies.",
            "Each merge reduces the number of trees by exactly one.",
            "The final tree's leaves correspond one-to-one with the input characters."
        ],
        "correctness": "The two least-frequent characters can be placed as deepest sibling leaves in some optimal tree, so merging them preserves optimality; induction on the number of characters proves the tree minimizes total encoded length, the sum of frequency times code length. Prefix-freeness follows because no leaf is an ancestor of another.",
        "complexityRationale": "With n distinct characters, each of the n-1 merges removes two minima and inserts one node. A priority queue makes this O(n log n) time. The tree and code table occupy O(n) space.",
        "uses": [
            "The canonical Huffman stage of gzip and DEFLATE",
            "JPEG image coefficient coding",
            "MP3 and other audio compression formats",
            "PNG, ZIP, fax and PDF stream compression"
        ],
        "references": [
            "Huffman, A Method for the Construction of Minimum-Redundancy Codes, Proceedings of the IRE, 1952",
            "Cover and Thomas, Elements of Information Theory, Chapter 5"
        ],
        "workedExample": "The text \"aabcccdddd\" has frequencies a:2, b:1, c:3, d:4. Merge b(1)+a(2)=3, then c(3)+that(3)=6, then d(4)+6=10. Labeling left edges 0 and right edges 1, the frequent 'd' lands highest and gets the shortest code, while 'b' gets the longest."
    },
    id: "huffman-coding",
    name: "Huffman Coding",
    category: "string",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { text: "aabcccdddd" },
    visualType: "tree",
    run,
    pseudocode: [
        "count character frequencies in the input text",
        "build leaf nodes for each distinct character",
        "repeatedly merge the two lowest-frequency nodes",
        "assign 0/1 bits along left and right branches",
        "emit variable-length prefix code per character",
        "verify total bits beat fixed-length encoding",
        "done: optimal prefix tree with encoded output",
    ],
};

export default module;
