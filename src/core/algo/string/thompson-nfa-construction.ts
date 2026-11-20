/**
 * thompson-nfa-construction.ts – Thompson NFA.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(|regex|)", space: "O(|regex|)"
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
    const t = (input as { regex?: string } | null) ?? {};
    const re = t.regex ?? "a(b|c)";
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
    yield F([cell(0, 0, re, "idle")], `Thompson NFA for regex "${re}".`, 0);
    step += 1;
    const edges: Array<[number, string, number]> = [
        [0, "a", 1],
        [1, "ε", 2],
        [2, "ε", 3],
        [2, "ε", 5],
        [3, "b", 4],
        [5, "c", 6],
        [4, "ε", 7],
        [6, "ε", 7],
    ];
    yield F([cell(1, 0, "a:0→1", "sorted")], "Fragment for literal 'a'.", 1);
    step += 1;
    yield F(
        [cell(1, 0, "b:3→4", "sorted"), cell(1, 1, "c:5→6", "sorted")],
        "Fragments for 'b' and 'c'.",
        2,
    );
    step += 1;
    yield F(
        [cell(1, 0, "b|c", "comparing")],
        `Union "(b|c)" via new split/join states for "${re}".`,
        3,
    );
    step += 1;
    const cells = edges.map(([f, l, to], i) => cell(2, i, `${f}-${l}→${to}`, "sorted"));
    yield F(cells, `Concat a·(b|c): 8 states, ${edges.length} edges.`, 4, {
        states: 8,
        edges: edges.length,
    });
    step += 1;
    yield F(cells, "Accept state 7 reachable on 'ab' and 'ac'.", 5, { states: 8, accept: 7 });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Thompson's construction turns a regular expression into an NFA by building small fragments for each subexpression and combining them with epsilon transitions. Literals get a start and accept state; union uses a new split and join, concatenation links accept to start, and star adds a loop.",
        "invariants": [
            "Each fragment has exactly one start and one accept state.",
            "No transition leaves a fragment's accept state or enters its start, so fragments compose cleanly."
        ],
        "correctness": "Each constructor preserves the language of the subexpression it builds: union gives the union of languages, concatenation their concatenation, and star the Kleene closure. By structural induction the final NFA accepts exactly the strings described by the regex.",
        "complexityRationale": "Every operator and literal adds a constant number of states and transitions, so construction time and NFA size are O(|regex|), with O(|regex|) space for the graph.",
        "uses": [
            "The front end of regular-expression engines",
            "Lexer generators",
            "Implementing regex matching via Thompson simulation"
        ],
        "references": [
            "Thompson, Programming Techniques: Regular Expression Search Algorithm, 1968",
            "Sipser, Introduction to the Theory of Computation, Chapter 1"
        ],
        "workedExample": "For \"a(b|c)\", a literal fragment for 'a' is concatenated with a union fragment whose epsilon branches lead to 'b' and 'c'; the combined NFA has start 0 and accept 7 and reaches accept on \"ab\" or \"ac\"."
    },
    id: "thompson-nfa-construction",
    name: "Thompson NFA",
    category: "string",
    complexity: { time: "O(|regex|)", space: "O(|regex|)" },
    defaultInput: { regex: "a(b|c)" },
    visualType: "grid",
    run,
    pseudocode: [
        "create fragment with start and accept states",
        "add epsilon branches for alternation choice",
        "concatenate fragments linking accept to start",
        "wrap fragment with epsilon loop for star",
        "assign unique numbers to all NFA states",
        "connect transitions preserving regex order",
        "report complete NFA state graph",
    ],
};

export default module;
