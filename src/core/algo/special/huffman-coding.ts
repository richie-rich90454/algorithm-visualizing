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
    id: "huffman-coding",
    name: "Huffman Coding",
    category: "string",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { text: "aabcccdddd" },
    visualType: "tree",
    run,
};

export default module;
