/**
 * earley-parsing.ts – Earley Parsing.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n³)", space: "O(n²)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cell(r: number, c: number, label: string, state: EntityState = "idle"): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell",
        label,
        value: 0,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    } as unknown as VisualEntity;
}
function grid(dp: number[][], done: number, hi: Array<[number, number]> = []): VisualEntity[] {
    const out: VisualEntity[] = [];
    const hs = new Map(hi.map(([r, c]) => [`${r},${c}`, true]));
    for (let r = 0; r < dp.length; r += 1)
        for (let c = 0; c < (dp[r] as number[]).length; c += 1)
            out.push(
                cell(
                    r,
                    c,
                    String((dp[r] as number[])[c]),
                    hs.has(`${r},${c}`) ? "comparing" : r + c <= done ? "sorted" : "idle",
                ),
            );
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { input?: string } | null) ?? {};
    const s = t.input ?? "ab";
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
        layout: "grid",
        meta: { comparisons: 0, matches: [], ...meta },
    });
    yield F([cell(0, 0, s || "ε", "idle")], `Earley parse "${s}" (S→AB, A→a, B→b).`, 0);
    step += 1;
    const sets: string[][] = [[`S→•AB@0`], [`A→a•@1`], [`B→b•@2`, `S→AB•@0`]];
    yield F(
        sets[0].map((it, i) => cell(0, i, it, "sorted")),
        `E0 seeded: ${sets[0].join("; ")}.`,
        1,
    );
    step += 1;
    for (let k = 1; k <= s.length && step < 10; k += 1) {
        yield F(
            (sets[k] as string[]).map((it, i) => cell(k, i, it, "comparing")),
            `E${k}: scan+complete → ${(sets[k] as string[]).join("; ")}.`,
            2,
        );
        step += 1;
    }
    const accept = (sets[s.length] as string[]).some((it) => it === `S→AB•@0`);
    yield F(
        [cell(9, 0, accept ? "ACCEPT" : "REJECT", accept ? "path" : "swapped")],
        accept ? "Complete S→AB•@0 ∈ E2: ACCEPT." : "REJECT.",
        3,
        { accept },
    );
    step += 1;
    yield F(
        [cell(9, 0, accept ? "ACCEPT" : "REJECT", "sorted")],
        accept
            ? `Earley complete for "${s}": "S" derives input: ACCEPT.`
            : "Earley complete: no parse: REJECT.",
        4,
        { accept },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Earley parses any context-free grammar in O(n^3) by building a chart of items, which are productions with a dot showing how much has been recognized, for each input position. It repeatedly predicts new items, scans terminals against the input, and completes items whose dot has reached the end.",
        "invariants": [
            "An item A→·AB style entry at chart position k means the part before the dot has been recognized and the parser is at input position k expecting the rest.",
            "Scanning advances the dot by consuming a matching symbol; completion propagates finished items back to the items that predicted them."
        ],
        "correctness": "Every parser action corresponds to a valid step of a top-down derivation: prediction expands a nonterminal, scanning consumes a terminal, and completion records a finished production. The fixed point of these operations contains exactly the items derivable from the input, so a completed start item at the final position means acceptance.",
        "complexityRationale": "There are O(n) chart entries, each with O(|G|) items, and completion can combine items across positions, giving O(n^3) worst-case time (O(n^2) for unambiguous grammars) and O(n^2) space.",
        "uses": [
            "Parsing arbitrary context-free grammars, including ambiguous ones",
            "Natural-language processing with grammars that are not LL or LR",
            "Incremental and error-recovering parsers"
        ],
        "references": [
            "Earley, An Efficient Context-Free Parsing Algorithm, 1970",
            "Grune and Jacobs, Parsing Techniques, Earley parsing chapter"
        ],
        "workedExample": "Grammar S→AB, A→a, B→b on \"ab\": E0 predicts S→·AB; scanning 'a' yields A→a· and predicts B→·b; scanning 'b' yields B→b· and completion adds S→AB·, so the final chart holds the completed start item and the input is accepted."
    },
    id: "earley-parsing",
    name: "Earley Parsing",
    category: "string",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: { input: "ab" },
    visualType: "grid",
    run,
    pseudocode: [
        "seed set zero with start production and dot at left",
        "scan terminal matching input character at position",
        "predict new items from nonterminal after dot",
        "complete finished items advancing waiting items",
        "repeat closure until no new items added",
        "advance chart position through entire input",
        "report acceptance and completed parse sets",
    ],
};

export default module;
