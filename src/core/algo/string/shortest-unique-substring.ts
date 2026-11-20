/**
 * shortest-unique-substring.ts – Shortest Unique Substring.
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
    const text = t.text ?? "ababc";
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
    yield F(tx(text), `Shortest substring occurring once in "${text}".`, 0);
    step += 1;
    const count = new Map<string, number>();
    for (let i = 0; i < text.length; i += 1)
        for (let j = i + 1; j <= text.length; j += 1) {
            const s = text.slice(i, j);
            count.set(s, (count.get(s) ?? 0) + 1);
        }
    yield F(tx(text), `${count.size} distinct substrings enumerated.`, 1);
    step += 1;
    let best = "";
    for (let len = 1; len <= text.length; len += 1) {
        const cands: Array<{ s: string; pos: number }> = [];
        for (let i = 0; i + len <= text.length; i += 1) {
            const s = text.slice(i, i + len);
            if (count.get(s) === 1) cands.push({ s, pos: i });
        }
        if (cands.length > 0) {
            cands.sort((x, y) => (x.s < y.s ? -1 : 1));
            const pick = cands[0] as { s: string; pos: number };
            best = pick.s;
            yield F(
                tx(
                    text,
                    stAt(
                        Array.from({ length: len }, (_, x) => pick.pos + x),
                        "comparing",
                    ),
                ),
                `Length ${len}: unique ${JSON.stringify(cands.map((c) => c.s))}.`,
                2,
            );
            step += 1;
            break;
        } else if (len <= 2) {
            yield F(tx(text), `No unique substring of length ${len}.`, 2);
            step += 1;
        }
    }
    const pos = text.indexOf(best);
    const fin = stAt(
        Array.from({ length: best.length }, (_, x) => pos + x),
        "sorted",
    );
    yield F(
        tx(text, fin),
        best ? `Shortest unique: "${best}" at ${pos}.` : "No unique substring.",
        3,
        { answer: best, pos },
    );
    step += 1;
    yield F(
        tx(text, fin),
        best
            ? `Search complete: shortest unique "${best}" at ${pos}.`
            : "Search complete: no unique substring.",
        4,
        { answer: best, pos },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "This finds the shortest substring that occurs exactly once in a string. It enumerates all substrings with occurrence counts, then tries increasing lengths and returns the first length that has any substring with count one, choosing the lexicographically smallest.",
        "invariants": [
            "count[s] is the number of occurrences of substring s.",
            "For a given length, any substring whose count is one is a valid unique substring, and no shorter length had one when the loop stops."
        ],
        "correctness": "Every substring is enumerated, so counts are exact. Trying lengths in increasing order means the first length with a unique substring is minimal, and returning the smallest candidate at that length yields the lexicographically smallest shortest unique substring.",
        "complexityRationale": "There are O(n^2) substrings and slicing and hashing can cost up to O(n) each, giving O(n^2) to O(n^3) work with O(n^2) space for the map; suffix structures can reduce this to O(n).",
        "uses": [
            "Designing unique identifiers or probes for sequences",
            "Primer design in bioinformatics",
            "Finding minimal distinguishing tokens in text"
        ],
        "references": [
            "Gusfield, Algorithms on Strings, Trees, and Sequences",
            "The unique-substring literature in bioinformatics"
        ],
        "workedExample": "For \"ababc\", the length-1 counts are a twice, b twice, c once, so \"c\" at index 4 is already unique and is the shortest unique substring."
    },
    id: "shortest-unique-substring",
    name: "Shortest Unique Substring",
    category: "string",
    complexity: { time: "O(n²)", space: "O(n²)" },
    defaultInput: { text: "ababc" },
    visualType: "text",
    run,
    pseudocode: [
        "enumerate all substrings with occurrence counts",
        "order candidates by increasing length",
        "test substrings of current length for uniqueness",
        "select lexicographically smallest unique candidate",
        "record its position and substring value",
        "stop at first length containing uniques",
        "report shortest unique substring and position",
    ],
};

export default module;
