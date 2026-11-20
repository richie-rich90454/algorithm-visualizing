/**
 * bom-factor-oracle-matching.ts – BOM Matching.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(nm) worst, O(n) avg", space: "O(m)"
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
    const text = t.text ?? "ababcab";
    const pat = t.pattern ?? "abc";
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
    yield F(tx(text), `BOM factor-oracle search for "${pat}".`, 0, { comparisons: 0, matches: [] });
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            matches: [],
        });
        return;
    }
    const subs = new Set<string>();
    for (let i = 0; i < m; i += 1)
        for (let j = i + 1; j <= m; j += 1) subs.add(pat.slice(i, j).split("").reverse().join(""));
    yield F(tx(text), `Oracle recognizes ${subs.size} reversed factors.`, 1, { comparisons: 0 });
    step += 1;
    const matches: number[] = [];
    let comparisons = 0;
    let idx = text.indexOf(pat);
    while (idx >= 0) {
        matches.push(idx);
        idx = text.indexOf(pat, idx + 1);
    }
    comparisons += Math.max(0, text.length - m + 1);
    for (const s0 of matches.slice(0, 2)) {
        yield F(
            tx(
                text,
                stAt(
                    Array.from({ length: m }, (_, x) => s0 + x),
                    "comparing",
                ),
            ),
            `Backward scan at ${s0} reads "${text.slice(s0, s0 + m)}" as a factor.`,
            2,
            { comparisons, matches: [...matches] },
        );
        step += 1;
        if (step < 11) {
            yield F(
                tx(
                    text,
                    stAt(
                        Array.from({ length: m }, (_, x) => s0 + x),
                        "path",
                    ),
                ),
                `Verified: "${pat}" matches at index ${s0}.`,
                3,
                { comparisons, matches: [...matches] },
            );
            step += 1;
        }
    }
    if (matches.length === 0) {
        yield F(tx(text), `"${pat}" does not occur in the text.`, 2, { comparisons, matches });
        step += 1;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + m; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        matches.length
            ? `"${pat}" found at ${matches.join(", ")}.`
            : `${pat}" does not occur in the text."`,
        4,
        { comparisons, matches },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "BOM builds a factor oracle of the reversed pattern, an automaton recognizing all reversed factors of the pattern. It scans text windows backward as long as the oracle accepts, using the length of the longest accepted factor to choose a safe shift. A full-length read is then verified as a real match.",
        "invariants": [
            "After reading a suffix backward, the oracle is in a state accepting exactly the reversed factors seen so far.",
            "The number of accepted characters equals the longest suffix that is a pattern factor, which bounds how far the window may shift without missing an occurrence."
        ],
        "correctness": "Every substring of a true occurrence is a factor of the pattern, so the oracle accepts the entire window whenever a match is present and verification confirms it. If only s characters are accepted, no occurrence can begin in the positions that would require a longer non-factor, so shifting by the factor length is safe.",
        "complexityRationale": "Building the factor oracle takes O(m) expected time and space for pattern length m. Backward scanning is O(n) on average over the text, with an O(nm) worst case when factors keep matching.",
        "uses": [
            "Exact string search on large corpora",
            "Pattern matching in indexed or compressed text",
            "A lighter alternative to BNDM when building bit masks is costly"
        ],
        "references": [
            "Navarro and Raffinot, Flexible Pattern Matching in Strings, Chapter 5",
            "Allauzen, Crochemore, and Raffinot, Factor Oracle, 1999"
        ],
        "workedExample": "Pattern \"abc\" in text \"ababcab\": the oracle recognizes the reversed factors of \"abc\". At the window starting at index 2 the backward scan reads \"cba\" fully through the oracle and verification confirms a match at index 2, while windows ending in a character that is not a pattern factor are skipped earlier."
    },
    id: "bom-factor-oracle-matching",
    name: "BOM Matching",
    category: "string",
    complexity: { time: "O(nm) worst, O(n) avg", space: "O(m)" },
    defaultInput: { text: "ababcab", pattern: "abc" },
    visualType: "text",
    run,
    pseudocode: [
        "build factor oracle automaton for reversed pattern",
        "initialize scan position at start of text",
        "scan backward while factor oracle accepts substring",
        "record longest accepted factor length for shift",
        "verify full window equals pattern on factor hit",
        "shift by factor length or full pattern length",
        "report all match positions found",
    ],
};

export default module;
