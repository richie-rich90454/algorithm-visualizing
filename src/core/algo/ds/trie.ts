/**
 * trie.ts – Trie (prefix tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A trie is a tree of prefixes: each edge carries one character, and a path
 * from the root spells a prefix. Inserting, searching, and prefix-checking a
 * word all walk the tree in O(|word|) time, independent of how many words are
 * stored. It is the standard structure for autocomplete and spell-checking.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / search / prefix: O(L) where L is the word length
 *   Space:                    O(total characters)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles; edges carry characters.
 *   - The current path being walked is YELLOW (comparing).
 *   - Word-ending nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Share prefixes" is the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Trie generator.
 *
 * @param input `{ words, search }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { words?: string[]; search?: string } | null) ?? {};
    const words = task.words ?? ["cat", "car", "cart", "dog"];
    const search = task.search ?? "car";

    let step = 0;

    // Build a trie node structure.
    type TrieNode = { children: Map<string, TrieNode>; end: boolean; id: number };
    const root: TrieNode = { children: new Map(), end: false, id: 0 };
    let nextId = 1;

    for (const word of words) {
        let node = root;
        for (const char of word) {
            let child = node.children.get(char);
            if (!child) {
                child = { children: new Map(), end: false, id: nextId };
                nextId += 1;
                node.children.set(char, child);
            }
            node = child;
        }
        node.end = true;
    }

    // Flatten to entities.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: TrieNode, parentId: string | null, parentChar: string | null): void => {
        const id = `n-${node.id}`;
        nodes.push({
            id,
            type: "node" as const,
            label: parentChar ?? "root",
            value: node.id,
            state: node.end ? "sorted" : "unvisited",
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
            walk(child, id, char);
        }
    };
    walk(root, null, null);

    // Frame 0: the trie.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Trie containing [${words.join(", ")}] – searching for "${search}".`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { words: words.length },
    };
    step += 1;

    // Walk the search word through the trie.
    let node = root;
    let matched = true;
    const path: string[] = [];
    for (const char of search) {
        const child = node.children.get(char);
        if (!child) {
            matched = false;
            break;
        }
        node = child;
        path.push(char);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({
                ...n,
                state: path.some(() => false)
                    ? n.state
                    : n.state === "sorted"
                      ? "sorted"
                      : "unvisited",
            })),
            edges: edges.map((e) => ({
                ...e,
                state: e.label === char && e.sourceId === `n-${node.id}` ? "active" : e.state,
            })),
            description: `Followed "${char}" – prefix "${path.join("")}" exists.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { words: words.length, prefix: path.join("") },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: matched
            ? `"${search}" is a valid prefix${node.end ? " and a stored word" : " (not a full word)"}.`
            : `"${search}" is not in the trie.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { words: words.length, found: matched },
    };
}

/** The Trie module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A trie is a tree of prefixes: each edge carries one character and a root-to-node path spells a prefix. Insert, search, and prefix queries walk one edge per character, independent of how many words are stored.",
        "invariants": [
            "Edges leaving a node carry distinct characters.",
            "A terminal marker identifies complete words.",
            "Every stored word has a path from the root."
        ],
        "correctness": "Following a word characters from the root either finds the path, proving the word or prefix exists, or hits a missing edge, proving it does not. Creating nodes on insertion adds exactly the needed path, so all inserted words are represented.",
        "complexityRationale": "Each operation visits one node per character, O(L) for word length L, regardless of the number of words. Space is one node per distinct prefix, O(total characters).",
        "uses": [
            "Autocomplete and type-ahead suggestions",
            "Spell checkers",
            "IP prefix routing and dictionary lookups"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.3 on digital searching",
            "Sedgewick and Wayne, Algorithms, 4th Edition, Section 5.2"
        ],
        "workedExample": "Words cat, car, cart, dog share nodes c-a and c-a-r; searching car follows c, a, r and reaches a terminal marker, while ca reaches a node that is a prefix but not a word."
    },
    id: "trie",
    name: "Trie",
    category: "data-structures",
    complexity: { time: "O(L) ops", space: "O(total chars)" },
    defaultInput: { words: ["cat", "car", "cart", "dog"], search: "car" },
    visualType: "tree",
    run,
    pseudocode: [
        "start with a bare root holding no characters",
        "insert word: walk one edge per character creating nodes as needed",
        "shared prefixes reuse existing nodes automatically",
        "mark the terminal node when the full word is stored",
        "search query: follow one edge per character from the root",
        "a missing edge means the prefix is absent entirely",
        "done: words share prefixes and the query verdict is reported",
    ],
};

export default module;
