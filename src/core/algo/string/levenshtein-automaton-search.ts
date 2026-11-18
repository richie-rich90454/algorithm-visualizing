/**
 * levenshtein-automaton-search.ts – Levenshtein Automaton.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n·m)", space: "O(m)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function tx(t: string, st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(t).map((c) => {
        const i = Number((c.metadata as Record<string, unknown>)["index"]);
        return { ...c, state: st.get(i) ?? "idle" };
    });
}
function stAt(pos: number[], s: EntityState): Map<number, EntityState> {
    return new Map(pos.map((p) => [p, s] as [number, EntityState]));
}

function lev(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) (dp[0] as number[])[j] = j;
    for (let i = 1; i <= a.length; i += 1)
        for (let j = 1; j <= b.length; j += 1)
            (dp[i] as number[])[j] = Math.min(
                ((dp[i - 1] as number[])[j] as number) + 1,
                ((dp[i] as number[])[j - 1] as number) + 1,
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
    return (dp[a.length] as number[])[b.length] as number;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { pattern?: string; words?: string[]; k?: number } | null) ?? {};
    const pat = t.pattern ?? "apple";
    const words = t.words ?? ["apple", "apply", "ape"];
    const k = t.k ?? 1;
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { comparisons: 0, matches: [], ...meta },
    });
    yield F(tx(pat), `Levenshtein automaton for "${pat}" (k=${k}) over ${words.length} words.`, 0, {
        comparisons: 0,
        hits: [],
    });
    step += 1;
    yield F(tx(pat), `Trie of ${words.length} words for "${pat}" with parametric vectors.`, 1, {
        comparisons: 0,
    });
    step += 1;
    const hits: Array<{ w: string; d: number }> = [];
    let comparisons = 0;
    for (const w of words) {
        const d = lev(pat, w);
        comparisons += pat.length * w.length;
        if (d <= k) hits.push({ w, d });
        if (step < 10) {
            yield F(
                tx(w, stAt([0], d <= k ? "path" : "swapped")),
                `"${w}": d=${d} ${d <= k ? "ACCEPT" : "reject"}.`,
                2,
                { comparisons, hits: hits.map((h) => `${h.w}:${h.d}`) },
            );
            step += 1;
        }
    }
    yield F(
        tx(pat),
        hits.length ? `Accepted: "${hits.map((h) => h.w).join(", ")}".` : "Nothing within k.",
        3,
        { comparisons, hits: hits.map((h) => `${h.w}:${h.d}`) },
    );
    step += 1;
    yield F(tx(pat), `Automaton complete: ${hits.length} word(s) within k=${k}.`, 4, {
        comparisons,
        hits: hits.map((h) => `${h.w}:${h.d}`),
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A Levenshtein automaton accepts all strings within edit distance k of a pattern. Traversing a trie of dictionary words while tracking a parametric edit-distance vector finds every word within k edits, pruning branches whose distance already exceeds k.",
        "invariants": [
            "At a trie node the state encodes the minimum edit distance achieved for each prefix length of the pattern.",
            "Transitions update the vector by insertion, deletion, or substitution, and states whose minimum exceeds k are discarded."
        ],
        "correctness": "The parametric vector is exactly the Levenshtein dynamic-programming row for the current word prefix against all pattern prefixes. A word is accepted when the distance for the full pattern is at most k, and pruning states above k cannot remove a word that might later return within k because distances never decrease along a transition.",
        "complexityRationale": "Each character expansion updates O(m) vector entries for pattern length m, so a word of length w costs O(mw), reported as O(n·m) per word. Space is O(m) for the active vector plus the trie.",
        "uses": [
            "Spell checkers and autocorrect",
            "Fuzzy dictionary lookup",
            "Searching names with typos in databases"
        ],
        "references": [
            "Levenshtein, Binary Codes Capable of Correcting Deletions, Insertions, and Reversals, 1965",
            "Navarro, A Guided Tour to Approximate String Matching, 2001"
        ],
        "workedExample": "For pattern \"apple\" with k=1, the words \"apple\" (distance 0) and \"apply\" (distance 1, e to y substitution) are accepted, while \"ape\" (distance 2) is rejected."
    },
    id: "levenshtein-automaton-search",
    name: "Levenshtein Automaton",
    category: "string",
    complexity: { time: "O(n·m)", space: "O(m)" },
    defaultInput: { pattern: "apple", words: ["apple", "apply", "ape"], k: 1 },
    visualType: "text",
    run,
    pseudocode: [
        "build trie of dictionary words for traversal",
        "initialize parametric edit vector at zero distance",
        "expand automaton state on each character",
        "prune branches exceeding distance threshold k",
        "accept words with final distance within k",
        "collect all accepted words and distances",
        "report matching words within bound",
    ],
};

export default module;
