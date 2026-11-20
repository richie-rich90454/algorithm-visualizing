/**
 * shunting-yard-parse.ts – Shunting-Yard.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n)", space: "O(n)"
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
    const t = (input as { expr?: string } | null) ?? {};
    const expr = t.expr ?? "3+4*2";
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
    const prec = new Map([
        ["+", 1],
        ["*", 2],
    ]);
    yield F(
        expr.split("").map((c, i) => cell(0, i, c, "idle")),
        `Shunting-yard on "${expr}".`,
        0,
    );
    step += 1;
    const out: string[] = [];
    const ops: string[] = [];
    const snap = (): VisualEntity[] => {
        const s: VisualEntity[] = [
            ...out.map((x, i) => cell(1, i, x, "sorted")),
            ...ops.map((x, i) => cell(2, i, x, "comparing")),
        ];
        if (s.length === 0) s.push(cell(1, 0, "∅", "idle"));
        return s;
    };
    yield F(snap(), 'Empty output "[]", empty operator stack "[]" at start.', 1);
    step += 1;
    for (const tok of expr.split("")) {
        if (/[0-9]/.test(tok)) out.push(tok);
        else {
            while (
                ops.length > 0 &&
                (prec.get(ops[ops.length - 1] as string) as number) >= (prec.get(tok) as number)
            )
                out.push(ops.pop() as string);
            ops.push(tok);
        }
        if (step < 10) {
            yield F(snap(), `Token "${tok}": out=[${out.join(" ")}] ops=[${ops.join(" ")}].`, 2);
            step += 1;
        }
    }
    while (ops.length > 0) out.push(ops.pop() as string);
    yield F(
        out.map((x, i) => cell(3, i, x, "path")),
        `RPN: ${out.join(" ")}.`,
        3,
        { rpn: out.join(" ") },
    );
    step += 1;
    yield F(
        out.map((x, i) => cell(3, i, x, "sorted")),
        `Parse complete: RPN is ${out.join(" ")}.`,
        4,
        { rpn: out.join(" ") },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The shunting-yard algorithm converts an infix expression to reverse Polish notation using an output queue and an operator stack. Numbers go straight to output; operators are pushed after popping operators of higher or equal precedence, and parentheses control grouping.",
        "invariants": [
            "The output queue holds a valid postfix prefix.",
            "The operator stack holds operators awaiting their right operands in order of increasing precedence from bottom to top."
        ],
        "correctness": "An operator is popped before a lower or equal precedence operator is pushed, which preserves evaluation order and associativity, and parentheses force a scope. Draining the stack at the end appends operators in correct postfix order, so the result evaluates identically to the infix expression.",
        "complexityRationale": "Each token is processed once and pushed or popped at most once, giving O(n) time and O(n) space for the stack and output.",
        "uses": [
            "Expression parsers in calculators and interpreters",
            "Compiler front-end expression handling",
            "Converting formulas for stack-based evaluation"
        ],
        "references": [
            "Dijkstra, Shunting-yard algorithm, 1961",
            "Aho et al., Compilers: Principles, Techniques, and Tools, Chapter 4"
        ],
        "workedExample": "For \"3+4*2\": output 3, push +; output 4, push * because it has higher precedence; output 2; drain the stack popping * then +, giving postfix \"3 4 2 * +\" which evaluates to 11."
    },
    id: "shunting-yard-parse",
    name: "Shunting-Yard",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { expr: "3+4*2" },
    visualType: "grid",
    run,
    pseudocode: [
        "read next token from input expression",
        "output numbers directly to output queue",
        "push operators respecting precedence rules",
        "pop higher precedence operators to output",
        "handle parentheses by stack push and pop",
        "drain remaining operators to output queue",
        "report reverse Polish notation output",
    ],
};

export default module;
