/**
 * distinct-substrings-count.ts – Distinct Substrings Count.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n²)", space: "O(n²)"
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { text?: string } | null) ?? {};
    const text = t.text ?? "aba";
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
    yield F(tx(text), `Counting distinct substrings of "${text}".`, 0);
    step += 1;
    const seen = new Set<string>();
    const byLen: number[] = [];
    for (let len = 1; len <= text.length; len += 1) {
        for (let i = 0; i + len <= text.length; i += 1) seen.add(text.slice(i, i + len));
        byLen.push(seen.size);
        if (len <= 3) {
            yield F(
                tx(text, stAt([len - 1], "comparing")),
                `Length ${len}: ${seen.size} so far.`,
                1,
                { count: seen.size },
            );
            step += 1;
        }
    }
    yield F(
        tx(
            text,
            stAt(
                text.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `${seen.size} distinct substrings.`,
        2,
        { count: seen.size },
    );
    step += 1;
    yield F(
        tx(text),
        `Done: n(n+1)/2=${(text.length * (text.length + 1)) / 2} total, ${seen.size} distinct.`,
        3,
        { count: seen.size },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "This counts how many different substrings a string contains. The straightforward method enumerates every substring by length and starting position and inserts each into a hash set; the set's size at the end is the answer.",
        "invariants": [
            "After processing length L the set contains exactly all distinct substrings of length at most L.",
            "Inserting a substring already present does not change the set, so the count grows only for genuinely new strings."
        ],
        "correctness": "Every substring has some length between 1 and n and some start, so the nested loops enumerate all of them. A hash set keeps one copy of each distinct value, so its final cardinality is exactly the number of distinct substrings.",
        "complexityRationale": "There are O(n^2) substrings and each slice plus hash insert can cost up to O(n) depending on the hashing model, so the work is O(n^2) to O(n^3) in the worst case; the module reports O(n^2) with O(n^2) storage. Suffix automata or suffix arrays do it in O(n).",
        "uses": [
            "Measuring string complexity and repeat richness",
            "Genomics metrics based on substring diversity",
            "A building block for substring-based text features"
        ],
        "references": [
            "Crochemore et al., Algorithms on Strings, chapter on suffix structures",
            "Gusfield, Algorithms on Strings, Trees, and Sequences"
        ],
        "workedExample": "For \"aba\": length 1 gives {a, b}; length 2 adds {ab, ba}; length 3 adds {aba}, for a total of 5 distinct substrings out of 6 occurrences, since \"a\" appears twice."
    },
    id: "distinct-substrings-count",
    name: "Distinct Substrings Count",
    category: "string",
    complexity: { time: "O(n²)", space: "O(n²)" },
    defaultInput: { text: "aba" },
    visualType: "text",
    run,
    pseudocode: [
        "initialize empty set for seen substrings",
        "enumerate substrings by growing length",
        "insert each substring into hash set",
        "count new entries as distinct substrings",
        "extend length until full string covered",
        "compute total minus duplicates for verification",
        "report distinct substring count",
    ],
};

export default module;
