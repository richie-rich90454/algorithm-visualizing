/**
 * cyk-parsing.ts – CYK Parsing.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n³·|G|)", space: "O(n²)"
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
    yield F([cell(0, 0, s, "idle")], `CYK parse "${s}" (S→AB, A→a, B→b).`, 0);
    step += 1;
    const n = s.length;
    const T: Set<string>[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => new Set<string>()),
    );
    for (let i = 0; i < n; i += 1) {
        if (s[i] === "a") (T[i] as Set<string>[])[i].add("A");
        if (s[i] === "b") (T[i] as Set<string>[])[i].add("B");
    }
    const show = (upto: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1)
            for (let j = i; j < Math.min(n, i + upto); j += 1)
                out.push(cell(i, j, [...(T[i] as Set<string>[])[j]].join("") || "∅", "sorted"));
        return out;
    };
    yield F(show(1), 'Length-1 cells from terminals "a" and "b".', 1);
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len <= n; i += 1) {
            const j = i + len - 1;
            for (let k = i; k < j; k += 1) {
                const L = (T[i] as Set<string>[])[k],
                    R = (T[k + 1] as Set<string>[])[j];
                if (L.has("A") && R.has("B")) (T[i] as Set<string>[])[j].add("S");
            }
        }
        yield F(show(len), `Spans of length ${len} combined.`, 2);
        step += 1;
    }
    const accept = (T[0] as Set<string>[])[n - 1].has("S");
    yield F(show(n), accept ? `S ∈ T[0][${n - 1}]: ACCEPT.` : "S missing: REJECT.", 3, { accept });
    step += 1;
    yield F(
        show(n),
        accept
            ? `Parse complete: "S" derives the input: ACCEPT.`
            : "Parse complete: no S derivation: REJECT.",
        4,
        { accept },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "CYK decides membership in a context-free grammar in Chomsky Normal Form using dynamic programming. It fills a triangular table where cell (i,j) holds the nonterminals that can derive the substring from i to j. Length-1 spans come from terminal rules and longer spans combine two shorter spans with binary rules.",
        "invariants": [
            "A nonterminal is in cell (i,j) if and only if it derives the exact substring s[i..j].",
            "The table is filled by increasing span length, so smaller spans needed for a combination are already complete."
        ],
        "correctness": "By induction on span length, length-1 cells are correct by the terminal productions. For a longer span, any derivation's first rule splits it into two nonempty parts covered by smaller spans; CYK tries every split and every binary rule, so it adds exactly the nonterminals that can derive the span. The start symbol in the top cell therefore means the whole string is derivable.",
        "complexityRationale": "There are O(n^2) spans, each trying O(n) split points and checking grammar rules, giving O(n^3·|G|) time in Chomsky Normal Form. The triangular table uses O(n^2) space.",
        "uses": [
            "Syntax checking for context-free languages",
            "Natural-language parsing",
            "The membership test underlying chart parsers"
        ],
        "references": [
            "Hopcroft and Ullman, Introduction to Automata Theory, Languages, and Computation, Chapter 5",
            "CLRS, Introduction to Algorithms, dynamic programming chapter"
        ],
        "workedExample": "Grammar S→AB, A→a, B→b on \"ab\": cell (0,0) gets A and cell (1,1) gets B; for span (0,1) the split k=0 has A on the left and B on the right, triggering S→AB so S is in the top cell and the string is accepted."
    },
    id: "cyk-parsing",
    name: "CYK Parsing",
    category: "string",
    complexity: { time: "O(n³·|G|)", space: "O(n²)" },
    defaultInput: { input: "ab" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize table with terminal productions for each character",
        "set diagonal cells from grammar terminal rules",
        "combine split intervals with binary productions",
        "fill longer spans from shorter constituent spans",
        "propagate derivations bottom-up through table",
        "check start symbol in top cell for acceptance",
        "report acceptance and parse table",
    ],
};

export default module;
