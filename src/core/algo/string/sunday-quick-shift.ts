/**
 * sunday-quick-shift.ts – Sunday Quick Search.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n/m) avg, O(nm) worst", space: "O(σ)"
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
    const text = t.text ?? "ababcabcab";
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
    yield F(tx(text), `Sunday search for "${pat}" in "${text}".`, 0, {
        comparisons: 0,
        matches: [],
    });
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            matches: [],
        });
        return;
    }
    const shift = new Map<string, number>();
    for (let i = 0; i < m; i += 1) shift.set(pat[i] as string, m - i);
    yield F(tx(text), `Shift table built over ${shift.size} distinct chars.`, 1, {
        comparisons: 0,
        shifts: shift.size,
    });
    step += 1;
    const matches: number[] = [];
    let comparisons = 0;
    let i = 0;
    while (i <= text.length - m) {
        let j = 0;
        while (j < m && text[i + j] === pat[j]) j += 1;
        comparisons += j + (j < m ? 1 : 0);
        const cur = Array.from({ length: m }, (_, k) => i + k);
        if (j === m) {
            matches.push(i);
            yield F(tx(text, stAt(cur, "path")), `Match: "${pat}" found at index ${i}.`, 2, {
                comparisons,
                matches: [...matches],
            });
            step += 1;
        } else {
            const s = new Map<number, EntityState>(
                cur.map((p) => [p, "comparing"] as [number, EntityState]),
            );
            s.set(i + j, "swapped");
            yield F(
                tx(text, s),
                `Mismatch: text[${i + j}]="${text[i + j]}" vs pattern[${j}]="${pat[j]}"; aligning text[${i + m}] next.`,
                3,
                {
                    comparisons,
                    shifts: shift.size,
                    matches: [...matches],
                },
            );
            step += 1;
        }
        if (step > 11) {
            i = text.length;
            break;
        }
        const nxt = text[i + m] ?? "";
        i += shift.get(nxt) ?? m + 1;
        if (matches.length > 0 && i > text.length - m) break;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let k = s0; k < s0 + m; k += 1) fin.set(k, "sorted");
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
        "intuition": "Sunday's algorithm compares a window left to right, but on a mismatch it chooses the shift from the text character immediately after the window. Because that next character must be matched by some pattern position if an occurrence starts nearby, the precomputed shift safely skips impossible alignments.",
        "invariants": [
            "The shift table gives, for each character, m minus its rightmost pattern position plus one, where m is the pattern length.",
            "Shifting by this value never skips an occurrence that would align that character with a pattern position."
        ],
        "correctness": "Any occurrence beginning in the skipped range would force the character just past the current window to align with a pattern position that, by the table's construction, cannot match; hence no occurrence is skipped. Full comparisons therefore find exactly the true matches.",
        "complexityRationale": "Building the table is O(m + sigma); searches are O(n/m) on average with good shifts and O(nm) worst case; space is O(sigma) for the table.",
        "uses": [
            "Fast exact substring search in editors",
            "Scanning large files for keywords",
            "A practical alternative to Boyer-Moore with simpler setup"
        ],
        "references": [
            "Sunday, A Very Fast Substring Search Algorithm, 1990",
            "Navarro and Raffinot, Flexible Pattern Matching in Strings"
        ],
        "workedExample": "Pattern \"abc\" in text \"ababcabcab\": the table maps a to 3, b to 2, c to 1, and other characters to 4. A mismatch at the first window looks at the character just past it and advances until the alignment at index 2 spells \"abc\" and is reported."
    },
    id: "sunday-quick-shift",
    name: "Sunday Quick Search",
    category: "string",
    complexity: { time: "O(n/m) avg, O(nm) worst", space: "O(σ)" },
    defaultInput: { text: "ababcabcab", pattern: "abc" },
    visualType: "text",
    run,
    pseudocode: [
        "build shift table using character after window",
        "align pattern at start of text",
        "compare window left to right for match",
        "record match when window equals pattern",
        "shift by table of character past window",
        "repeat until window exceeds text length",
        "report all match positions found",
    ],
};

export default module;
