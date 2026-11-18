/**
 * suffix-array-search.ts – Suffix Array Search.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(m log n)", space: "O(n)"
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
    const t = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = t.text ?? "banana";
    const pat = t.pattern ?? "ana";
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
    yield F(tx(text), `Binary-search "${pat}" over suffix array of "${text}".`, 0, {
        comparisons: 0,
        matches: [],
    });
    step += 1;
    const sa = Array.from({ length: text.length }, (_, i) => i).sort((a, b) =>
        text.slice(a) < text.slice(b) ? -1 : 1,
    );
    yield F(tx(text), `SA = [${sa.join(", ")}].`, 1, { comparisons: 0, sa });
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            matches: [],
        });
        return;
    }
    let comparisons = 0;
    let lo = 0,
        hi = sa.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const suf = text.slice(sa[mid] as number);
        comparisons += 1;
        yield F(
            tx(text, stAt([sa[mid] as number], "comparing")),
            `Compare "${pat}" vs suffix "${suf}" (bisection at ${mid}).`,
            2,
            { comparisons, sa },
        );
        step += 1;
        if (suf < pat) lo = mid + 1;
        else hi = mid;
        if (step > 10) break;
    }
    const matches = sa.filter((s) => text.startsWith(pat, s)).sort((a, b) => a - b);
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        matches.length
            ? `"${pat}" at ${matches.join(", ")}.`
            : `${pat}" does not occur in the text."`,
        3,
        { comparisons, matches, sa },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A suffix array lists all suffixes in sorted order, so a pattern's occurrences form a contiguous block. Binary search compares the pattern with a middle suffix to narrow the range; after finding one match, neighbors are scanned to collect all occurrences.",
        "invariants": [
            "The suffixes are in lexicographic order, so the suffixes beginning with the pattern form a contiguous interval.",
            "Binary search maintains that any match lies within the current bounds."
        ],
        "correctness": "Comparing the pattern with a suffix orders them lexicographically, so discarding the half on the wrong side cannot remove a suffix starting with the pattern. When bounds meet, any matching suffix plus its neighbors gives all occurrences because matches are contiguous.",
        "complexityRationale": "Each binary-search step compares the pattern to a suffix in O(m) with O(log n) steps, giving O(m log n) time, and collecting k matches adds O(km); the suffix array uses O(n) space.",
        "uses": [
            "Full-text substring search with a suffix array",
            "Counting occurrences in large documents",
            "The query step of suffix-array-based indexes"
        ],
        "references": [
            "Manber and Myers, Suffix Arrays: A New Method for On-Line String Searches, 1990",
            "Gusfield, Algorithms on Strings, Trees, and Sequences"
        ],
        "workedExample": "For text \"banana\" and pattern \"ana\", binary search over [5,3,1,0,4,2] locates the block containing suffixes \"ana\" and \"anana\", reporting starts 3 and 1."
    },
    id: "suffix-array-search",
    name: "Suffix Array Search",
    category: "string",
    complexity: { time: "O(m log n)", space: "O(n)" },
    defaultInput: { text: "banana", pattern: "ana" },
    visualType: "text",
    run,
    pseudocode: [
        "build suffix array of text in sorted order",
        "set binary search bounds over suffix array",
        "compare pattern with middle suffix string",
        "narrow bounds based on lexicographic order",
        "repeat until interval collapses to lower bound",
        "collect consecutive matches around bound",
        "report all match positions found",
    ],
};

export default module;
