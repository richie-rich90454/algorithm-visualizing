/**
 * shift-or-bitap.ts – Shift-Or Bitap.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n·m/w)", space: "O(σ)"
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
    yield F(tx(text), `Shift-Or exact search for "${pat}".`, 0, { comparisons: 0, matches: [] });
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            matches: [],
        });
        return;
    }
    const mask = new Map<string, number>();
    for (const ch of new Set((text + pat).split(""))) {
        let bits = 0;
        for (let i = 0; i < m; i += 1) if (pat[i] !== ch) bits |= 1 << i;
        mask.set(ch, bits);
    }
    yield F(tx(text), `Bitmasks built for m=${m}.`, 1, { comparisons: 0 });
    step += 1;
    const matches: number[] = [];
    let comparisons = 0;
    let D = ~0;
    const all = (1 << m) - 1;
    for (let i = 0; i < text.length; i += 1) {
        D = ((D << 1) | 1) & (mask.get(text[i] as string) ?? all) & ((1 << m) - 1 || -1);
        comparisons += 1;
        const hit = (D & (1 << (m - 1))) === 0;
        if (hit) matches.push(i - m + 1);
        if (i < 6 || hit) {
            const s = new Map<number, EntityState>([[i, hit ? "path" : "comparing"]]);
            yield F(
                tx(text, s),
                hit
                    ? `Match: "${pat}" ends at ${i} (starts at ${i - m + 1}).`
                    : `text[${i}]="${text[i]}" folds into bit state D.`,
                2,
                { comparisons, matches: [...matches] },
            );
            step += 1;
        }
        if (step > 11) break;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let k = s0; k < s0 + m; k += 1) fin.set(k, "sorted");
    yield F(
        tx(text, fin),
        matches.length
            ? `"${pat}" found at ${matches.join(", ")}.`
            : `${pat}" does not occur in the text."`,
        3,
        { comparisons, matches },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Shift-Or is a bit-parallel exact search. For each character a mask marks which pattern positions that character does not match. A single state word is shifted and masked per text character, and a zero in the top bit signals that the pattern has just been matched.",
        "invariants": [
            "After processing text character i, bit j of the state is zero exactly when the pattern prefix of length j+1 matches the text suffix ending at i.",
            "The mask for a character has zeros at positions where that character is allowed."
        ],
        "correctness": "Shifting left moves each prefix match to the next length and AND-ing with the character mask keeps only positions where the new character matches. Thus a clear bit j after processing means the length-(j+1) prefix matches the current suffix, and a clear top bit means a full match ended here.",
        "complexityRationale": "Each text character needs one shift, one OR, and one AND on a word of ceil(m/w) words, so search is O(n·m/w) time; masks use O(sigma·m/w) words of space.",
        "uses": [
            "Fast exact search for short patterns",
            "The shift-and foundation of approximate matching",
            "Search in resource-constrained devices"
        ],
        "references": [
            "Baeza-Yates and Gonnet, A New Approach to Text Searching, 1992",
            "Navarro and Raffinot, Flexible Pattern Matching in Strings"
        ],
        "workedExample": "For pattern \"abc\" and text \"ababcab\", processing characters folds the state until reading the 'c' at index 4 clears the top bit, reporting the match \"abc\" ending at index 4."
    },
    id: "shift-or-bitap",
    name: "Shift-Or Bitap",
    category: "string",
    complexity: { time: "O(n·m/w)", space: "O(σ)" },
    defaultInput: { text: "ababcab", pattern: "abc" },
    visualType: "text",
    run,
    pseudocode: [
        "precompute bitmasks marking mismatches per character",
        "initialize state vector to all ones",
        "update state by shifting and masking input",
        "detect zero in high bit as pattern match",
        "record ending position converting to start index",
        "advance through text character by character",
        "report all match start positions",
    ],
};

export default module;
