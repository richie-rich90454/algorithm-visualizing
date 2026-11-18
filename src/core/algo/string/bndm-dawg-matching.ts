/**
 * bndm-dawg-matching.ts – BNDM.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(nm) worst, O(n/m) avg", space: "O(m·σ)"
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
    const pat = t.pattern ?? "cab";
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
    yield F(tx(text), `BNDM backward scan for "${pat}".`, 0, { comparisons: 0, matches: [] });
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            matches: [],
        });
        return;
    }
    yield F(tx(text), `Suffix-automaton masks for m=${m}.`, 1, { comparisons: 0 });
    step += 1;
    const matches: number[] = [];
    let comparisons = 0;
    let pos = 0;
    while (pos <= text.length - m) {
        let D = ~0,
            last = -1,
            j = m - 1;
        while (j >= 0) {
            let s = 0;
            for (let i = 0; i < m; i += 1) if (pat[m - 1 - i] === text[pos + j]) s |= 1 << i;
            D = (D << 1) & s;
            comparisons += m;
            if (D === 0) break;
            if ((D & (1 << (m - 1))) !== 0) last = j;
            j -= 1;
        }
        comparisons += m;
        let ok = last >= 0 && text.slice(pos, pos + m) === pat;
        if (ok) {
            matches.push(pos);
            yield F(
                tx(
                    text,
                    stAt(
                        Array.from({ length: m }, (_, x) => pos + x),
                        "path",
                    ),
                ),
                `Match: "${pat}" found at index ${pos}.`,
                2,
                { comparisons, matches: [...matches] },
            );
            step += 1;
        } else {
            yield F(
                tx(text, stAt([pos], "comparing")),
                `Window ${pos}: text[${pos}]="${text[pos]}" rules out "${pat}" here.`,
                3,
                { comparisons, matches: [...matches] },
            );
            step += 1;
        }
        pos += last >= 0 ? m - last - 1 || 1 : m;
        if (step > 11 || pos > text.length - m) break;
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
        "intuition": "BNDM scans a text window from right to left while maintaining a bit mask of which pattern prefixes match the suffix read so far. A precomputed mask per character tells which positions that character can occupy in the pattern. When the mask becomes zero, no prefix matches and the window can be shifted safely.",
        "invariants": [
            "After reading j characters backward, bit i of the state is set exactly when the pattern prefix of length i+1 matches the characters just read.",
            "The rightmost set bit records the longest matched prefix, which determines the safe shift distance."
        ],
        "correctness": "The update D = (D << 1) & charMask exactly simulates extending every currently matching prefix by one character to the left. If D becomes zero, no pattern prefix matches the read suffix, so no occurrence can start in the skipped region. When the full-prefix bit is set, the window spells the pattern and is reported as a verified match.",
        "complexityRationale": "Each character update is a constant number of bit operations, so a window costs O(m) in the worst case but O(1) amortized per alignment, giving O(n) typical time. Masks use O(m·sigma) space, or O(sigma) machine words for the bit-parallel state.",
        "uses": [
            "Fast exact pattern search in large texts",
            "Substring search in bioinformatics pipelines",
            "The bit-parallel engine behind several grep-like tools"
        ],
        "references": [
            "Navarro and Raffinot, Flexible Pattern Matching in Strings, Chapter 4",
            "Baeza-Yates and Gonnet, A New Approach to Text Searching, 1992"
        ],
        "workedExample": "Text \"ababcab\", pattern \"cab\" scanned backward: reading 'b' sets the bit where 'b' appears in \"cab\", reading 'a' extends the matched prefix to \"ab\", and reading 'c' completes \"cab\" so the top bit is set and a match is reported at index 4."
    },
    id: "bndm-dawg-matching",
    name: "BNDM",
    category: "string",
    complexity: { time: "O(nm) worst, O(n/m) avg", space: "O(m·σ)" },
    defaultInput: { text: "ababcab", pattern: "cab" },
    visualType: "text",
    run,
    pseudocode: [
        "initialize bit masks for pattern suffix automaton",
        "set active state to all ones for backward scan",
        "scan window backward updating state with masks",
        "fall back when state becomes zero with no factor",
        "record last prefix position as shift anchor",
        "shift window by m minus anchor or full length",
        "report all match positions found",
    ],
};

export default module;
