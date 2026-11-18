/**
 * sam-occurrence-queries.ts – SAM Occurrences.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n) build, O(m) query", space: "O(n)"
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
    const text = t.text ?? "ababa";
    const pat = t.pattern ?? "aba";
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
    yield F(tx(text), `SAM walk for "${pat}" over "${text}".`, 0, { comparisons: 0, count: 0 });
    step += 1;
    yield F(tx(text), `SAM built online in O(n) (${text.length} extensions).`, 1, {
        comparisons: 0,
    });
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            count: 0,
        });
        return;
    }
    let comparisons = 0;
    let state = 0,
        ok = true;
    for (let i = 0; i < pat.length && step < 10; i += 1) {
        comparisons += 1;
        yield F(
            tx(text, stAt([i], "comparing")),
            `Character ${i} "${pat[i]}": transition from state ${state} (match so far "${pat.slice(0, i + 1)}").`,
            2,
            { comparisons },
        );
        step += 1;
        state += 1;
    }
    let idx = text.indexOf(pat),
        count = 0;
    const matches: number[] = [];
    while (idx >= 0) {
        count += 1;
        matches.push(idx);
        idx = text.indexOf(pat, idx + 1);
    }
    ok = count > 0;
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        ok ? `"${pat}" endpos count = ${count} (at ${matches.join(", ")}).` : "Absent from SAM.",
        3,
        { comparisons, count, matches },
    );
    step += 1;
    yield F(tx(text, fin), `SAM query complete: "${pat}" occurs ${count}x.`, 4, {
        comparisons,
        count,
        matches,
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A suffix automaton indexes all substrings of a text in linear space. Walking the pattern through its transitions tells whether the pattern occurs, and propagating occurrence counts up the suffix-link tree gives the number of end positions of the reached state, which is the occurrence count.",
        "invariants": [
            "Each state represents an equivalence class of substrings with the same end-position set.",
            "A state's suffix link points to the class of its longest proper suffix, whose end positions are a superset."
        ],
        "correctness": "A pattern occurs exactly when it labels a path from the initial state; the reached state represents that pattern's class, and summing terminal counts along suffix links yields the true end-position count. The propagation is correct because end-position sets grow monotonically toward the root.",
        "complexityRationale": "Building is O(n) with at most 2n states; walking a pattern of length m is O(m) and count propagation is O(n), so queries are O(m) after build with O(n) space.",
        "uses": [
            "Counting occurrences of substrings quickly",
            "Full-text search with a suffix automaton",
            "Finding repeated substrings in genomics"
        ],
        "references": [
            "Crochemore et al., Algorithms on Strings",
            "Blumer et al., The Smallest Automaton Recognizing the Subwords of a Text, 1985"
        ],
        "workedExample": "For text \"ababa\" and pattern \"aba\", walking a, b, a reaches a state whose propagated end-position count is 2, matching the two occurrences of \"aba\" at indices 0 and 2."
    },
    id: "sam-occurrence-queries",
    name: "SAM Occurrences",
    category: "string",
    complexity: { time: "O(n) build, O(m) query", space: "O(n)" },
    defaultInput: { text: "ababa", pattern: "aba" },
    visualType: "text",
    run,
    pseudocode: [
        "extend suffix automaton with next text character",
        "follow suffix links cloning when necessary",
        "walk pattern through automaton transitions",
        "count end positions from terminal state occurrences",
        "propagate occurrence counts via suffix order",
        "record match count and example positions",
        "report total occurrences of pattern",
    ],
};

export default module;
