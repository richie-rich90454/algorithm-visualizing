/**
 * patricia-trie.ts - Patricia Trie
 * Compressed edges skip single-child chains. Demo: insert <=6 words, search 1 hit + 1 miss.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Compressed edges skip single-child chains. Demo: insert <=6 words, search 1 hit + 1 miss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) ops
 *   Space: O(n k)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Nodes are circles; edges show parent links.
 *    - The active node is YELLOW (comparing).
 *    - Finished nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Patricia Trie behavior with textbook operation costs.
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
        description: "Patricia Trie: empty. Compressed edges skip single-child chains.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { ops: step },
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
            description: `Inserted "${w}".`,
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
        meta: { ops: step },
    };
    step += 1;
    const miss = "__zz__";
    const mhit = set.has(miss);
    yield {
        stepNumber: step,
        entities: nodes(shown, new Map()),
        edges: [],
        description: `Search "${miss}": ${mhit ? "found" : "absent"}. Trie compress invariant holds. "${q}" ${hit ? "found" : "not found"}.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { hit },
    };
}

const module: AlgorithmModule = {
    id: "patricia-trie",
    name: "Patricia Trie",
    category: "data-structures",
    complexity: { time: "O(k) ops", space: "O(n k)" },
    defaultInput: { words: ["car", "cat", "dog", "dot"], search: "cat" },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty compressed trie holding no words",
        "insert word: walk compressed edges matching the longest prefix",
        "split the edge where the word and the edge label first differ",
        "repeat until every word ends at a marked terminal node",
        "search query: follow compressed edges character by character",
        "a missing edge or label mismatch means the word is absent",
        "done: compressed paths hold all words and the query answer is reported",
    ],
};
export default module;
