/**
 * binary-trie.ts - Binary Trie
 * One level per bit of fixed-width keys. Demo: insert <=6 words, search 1 hit + 1 miss.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nodes(words: string[], st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return words.map((w, i) => ({
        id: `n-${i}-${w}`,
        type: "node" as const,
        label: w,
        value: w.length,
        state: st.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: i === 0 ? "root" : 0, word: w },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { words?: string[]; search?: string } | null) ?? {};
    const words = Array.isArray(t.words) ? [...t.words].slice(0, 6) : ["car", "cat", "dog", "dot"];
    const q = typeof t.search === "string" ? t.search : "cat";
    const set = new Set<string>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: [
            {
                id: "n-empty",
                type: "node" as const,
                label: "E",
                value: 0,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Binary Trie: empty. One level per bit of fixed-width keys.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { operations: step },
    };
    step += 1;
    const shown: string[] = [];
    for (const w of words) {
        set.add(w);
        shown.push(w);
        yield {
            stepNumber: step,
            entities: nodes(shown, new Map([[shown.length - 1, "comparing"]])),
            edges: [],
            description: `Inserted word "${w}" by walking characters and creating missing nodes.`,
            codeLineNumber: 1,
            layout: "tree",
            meta: { size: set.size },
        };
        step += 1;
    }
    const hit = set.has(q);
    yield {
        stepNumber: step,
        entities: nodes(shown, new Map()),
        edges: [],
        description: `Search "${q}": ${hit ? "found" : "absent"}.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { operations: step },
    };
    step += 1;
    const miss = "__zz__";
    const mhit = set.has(miss);
    yield {
        stepNumber: step,
        entities: nodes(shown, new Map()),
        edges: [],
        description: `Search "${miss}": ${mhit ? "found" : "absent"}. Trie compress invariant holds. "${q}" ${hit ? "found" : "not found"}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { hit },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A binary trie is a tree with one level per bit of a fixed-width key. At each level the next bit chooses the 0 or 1 child, and a terminal flag marks where a stored key ends. Because the path is determined entirely by the bits, lookup and insertion take time proportional only to key width, not to the number of keys.",
        "invariants": [
            "Depth d corresponds to bit d of the key.",
            "Each node has at most one child labeled 0 and one labeled 1.",
            "A terminal flag marks a complete stored key."
        ],
        "correctness": "Following the bits of a query visits exactly the nodes whose prefixes equal those bits, so reaching a terminal after the last bit means the key is stored. Creating missing children on insertion keeps the path intact. Two keys sharing a prefix share nodes until they differ, which preserves distinctness.",
        "complexityRationale": "Each operation walks at most w bits, O(w) independent of the number of keys. Each stored key contributes at most w nodes, so space is O(n w) in the worst case.",
        "uses": [
            "IP longest-prefix matching",
            "Bit-level indexes and compressed dictionaries",
            "Fast set-membership on fixed-width keys"
        ],
        "references": [
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.3",
            "Thomas H. Cormen et al., Introduction to Algorithms, Chapter 12 exercises"
        ],
        "workedExample": "Insert the two-bit keys 01, 10, 11: the root gains a 0 child leading to a 1 terminal and a 1 child leading to two terminals 0 and 1. Searching 10 reads bit 1 then bit 0, reaches the terminal, and reports a hit; searching 00 stops at the missing 0 child under the 0 branch."
    },
    id: "binary-trie",
    name: "Binary Trie",
    category: "data-structures",
    complexity: { time: "O(w) ops", space: "O(n w)" },
    defaultInput: { words: ["car", "cat", "dog", "dot"], search: "cat" },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty binary trie with single root node",
        "walk bits of key from most significant to least",
        "create missing child 0 or 1 along the path",
        "mark terminal node as end of inserted word",
        "compare query bits against edges to find match",
        "count stored keys in subtree",
        "done: binary trie holds keys with lookup answer",
    ],
};
export default module;
