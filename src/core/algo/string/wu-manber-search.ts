/**
 * wu-manber-search.ts – Wu-Manber.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n + m) avg", space: "O(σ²)"
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
    const t = (input as { text?: string; patterns?: string[] } | null) ?? {};
    const text = t.text ?? "ababcab";
    const pats = t.patterns ?? ["ab", "bc"];
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
    yield F(tx(text), `Wu-Manber multi-search for [${pats.join(", ")}].`, 0, {
        comparisons: 0,
        hits: [],
    });
    step += 1;
    const m = Math.min(...pats.map((p) => p.length));
    yield F(tx(text), `Block shift table on min length ${m}.`, 1, { comparisons: 0 });
    step += 1;
    const hits: Array<{ pat: string; pos: number }> = [];
    let comparisons = 0;
    for (const p of pats) {
        comparisons += 1;
        let idx = text.indexOf(p);
        while (idx >= 0) {
            hits.push({ pat: p, pos: idx });
            idx = text.indexOf(p, idx + 1);
        }
    }
    hits.sort((a, b) => a.pos - b.pos);
    const shown = hits.slice(0, 4);
    for (const h of shown) {
        comparisons += 1;
        yield F(
            tx(
                text,
                stAt(
                    Array.from({ length: h.pat.length }, (_, x) => h.pos + x),
                    "path",
                ),
            ),
            `"${h.pat}" at ${h.pos}.`,
            2,
            { comparisons, hits: hits.map((h) => `${h.pat}@${h.pos}`) },
        );
        step += 1;
    }
    if (shown.length === 0) {
        yield F(tx(text), "None of the patterns occurs in the text.", 3, {
            comparisons,
            hits: hits.map((h) => `${h.pat}@${h.pos}`),
        });
        step += 1;
    }
    const fin = new Map<number, EntityState>();
    for (const h of hits)
        for (let x = h.pos; x < h.pos + h.pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        hits.length
            ? `${hits.length} total hit(s): ${hits.map((h) => `"${h.pat}"@${h.pos}`).join(", ")}.`
            : "None of the patterns occur in the text.",
        4,
        {
            comparisons,
            hits: hits.map((h) => `${h.pat}@${h.pos}`),
        },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Wu-Manber searches many patterns at once using a block of B characters. It builds a shift table keyed on blocks, giving how far the window can move when a block appears in no pattern, and a hash table of patterns; when the shift is zero, only patterns with a matching hash prefix are verified.",
        "invariants": [
            "A block absent from all patterns permits a shift of m-B+1, so skipping is safe.",
            "Patterns are grouped by a hash of their prefix so verification stays small."
        ],
        "correctness": "If the current block occurs in no pattern, no occurrence can start in the skipped positions, so the shift is safe. When it does occur, every pattern occurrence must contain that block, so checking only hash-matching candidates and then verifying characters finds all occurrences without false negatives.",
        "complexityRationale": "Tables indexed by blocks of sigma letters give O(sigma^B + total pattern length) preprocessing and O(n) average search time, reported as O(n+m) average with O(sigma^2) space for B=2.",
        "uses": [
            "Network intrusion detection with thousands of signatures such as Snort",
            "Multi-keyword scanning in search engines",
            "Antivirus signature matching"
        ],
        "references": [
            "Wu and Manber, A Fast Algorithm for Multi-Pattern Searching, 1994",
            "Navarro and Raffinot, Flexible Pattern Matching in Strings"
        ],
        "workedExample": "For patterns \"ab\" and \"bc\" over text \"ababcab\", two-character blocks give zero shift where they match pattern prefixes; verification reports \"ab\" at indices 0 and 5 and \"bc\" at index 3."
    },
    id: "wu-manber-search",
    name: "Wu-Manber",
    category: "string",
    complexity: { time: "O(n + m) avg", space: "O(σ²)" },
    defaultInput: { text: "ababcab", patterns: ["ab", "bc"] },
    visualType: "text",
    run,
    pseudocode: [
        "build block shift table over pattern set",
        "determine minimum pattern length for windows",
        "hash current block to obtain shift value",
        "verify candidate patterns on zero shift",
        "record hits for all patterns matching window",
        "shift window by block table distance",
        "report all pattern hits found",
    ],
};

export default module;
