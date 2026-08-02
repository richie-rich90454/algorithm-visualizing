/**
 * suffix-trie.ts – Suffix Trie
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A suffix trie is a trie containing every suffix of a string, with a special
 * end marker. It makes substring queries trivial: "is s a substring?" becomes
 * "does the trie contain a path for s?" at O(|s|) cost, independent of the
 * string length. Its cost is space – a string of length n can need O(n²)
 * nodes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build:   O(n²) nodes worst case
 *   Substring query: O(|s|)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The root-to-leaf paths spell the suffixes.
 *   - The queried substring's path is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The compressed sibling (suffix array / suffix tree) fixes the space.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Suffix Trie generator.
 *
 * @param input `{ text, query }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; query?: string } | null) ?? {};
    const text = task.text ?? "banana";
    const query = task.query ?? "ana";

    let step = 0;

    // Build the suffix trie (a trie of all suffixes).
    type TrieNode = { children: Map<string, TrieNode>; id: number };
    const root: TrieNode = { children: new Map(), id: 0 };
    let nextId = 1;

    for (let i = 0; i < text.length; i += 1) {
        let node = root;
        for (let j = i; j < text.length; j += 1) {
            const char = text[j] as string;
            let child = node.children.get(char);
            if (!child) {
                child = { children: new Map(), id: nextId };
                nextId += 1;
                node.children.set(char, child);
            }
            node = child;
        }
    }

    // Flatten.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: TrieNode, parentId: string | null): void => {
        const id = `n-${node.id}`;
        nodes.push({
            id,
            type: "node" as const,
            label: parentId === null ? "root" : "",
            value: node.id,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentId ?? "root" },
        });
        for (const [char, child] of node.children) {
            edges.push({
                id: `e-${node.id}-${child.id}`,
                sourceId: id,
                targetId: `n-${child.id}`,
                label: char,
                state: "idle",
                directed: true,
            });
            walk(child, id);
        }
    };
    walk(root, null);

    // Frame 0: the suffix trie.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Suffix trie of "${text}" – checking if "${query}" is a substring.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    // Query walk.
    let node = root;
    let matched = true;
    let matchedChars = "";
    for (const char of query) {
        const child = node.children.get(char);
        if (!child) {
            matched = false;
            break;
        }
        node = child;
        matchedChars += char;
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Walked "${char}" – matched prefix "${matchedChars}".`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { matched: matchedChars },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: matched
            ? `"${query}" IS a substring of "${text}".`
            : `"${query}" is NOT a substring of "${text}".`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { found: matched },
    };
}

/** The Suffix Trie module, registered with the engine. */
const module: AlgorithmModule = {
    id: "suffix-trie",
    name: "Suffix Trie",
    category: "data-structures",
    complexity: { time: "O(|s|) query", space: "O(n²) worst" },
    defaultInput: { text: "banana", query: "ana" },
    visualType: "tree",
    run,
};

export default module;
