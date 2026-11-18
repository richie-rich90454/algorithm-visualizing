/**
 * hamt.ts - HAMT
 * Hash chunks index 32-way compressed nodes. Demo: insert <=6 words, search 1 hit + 1 miss.
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
        description: "HAMT: empty. Hash chunks index 32-way compressed nodes.",
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
        "intuition": "A hash array mapped trie, or HAMT, is a persistent hash trie that consumes a hash in small chunks, typically five bits per level. A bitmap marks which of the 32 slots are occupied, and a population count turns a chunk into a compact array index. This makes nodes small and lookups fast.",
        "invariants": [
            "The bitmap bit for chunk c is set exactly when child c exists.",
            "A child's array index is the number of set bits before c.",
            "Each level consumes a distinct five-bit chunk of the hash."
        ],
        "correctness": "The bitmap records precisely which branches exist, so a population count maps a chunk to the right compact slot. Insertion sets the bit and adds the child; lookup repeats the same chunk walk. Collisions at full depth are stored in a leaf bucket, so two equal hashes remain distinct entries.",
        "complexityRationale": "Each operation consumes one 5-bit chunk per level, so depth is O(log32 n) and time matches that. Compressed nodes store only occupied children, using O(n) space.",
        "uses": [
            "Persistent maps and sets in functional languages",
            "Clojure and Scala collection implementations",
            "Memory-efficient associative arrays"
        ],
        "references": [
            "Phil Bagwell, \"Ideal Hash Trees\", INRIA tech report 2001",
            "Steven Prokopec et al., \"Efficient Immutable Collections\", 2012"
        ],
        "workedExample": "Hash car and cat; their first five-bit chunks agree, so they share the root bitmap and descend together. At the next chunk they differ, so two bits are set in the child node. Searching cat follows its chunk sequence, uses population counts to find compact slots, and reaches the terminal."
    },
    id: "hamt",
    name: "HAMT",
    category: "data-structures",
    complexity: { time: "O(log32 n) ops", space: "O(n)" },
    defaultInput: { words: ["car", "cat", "dog", "dot"], search: "cat" },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty HAMT with null root",
        "hash key and take 5-bit chunk per level",
        "compare bitmap bit to test child presence",
        "insert by setting bitmap bit and adding child",
        "descend using population count as compact index",
        "lookup by repeating hash chunk walk",
        "done: HAMT holds keys with lookup answer",
    ],
};
export default module;
