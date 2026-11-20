/**
 * pratt-parser.ts - Pratt Parser (precedence climbing)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Pratt parser builds an expression tree using binding powers attached to
 * operators. Each token knows how to start an expression (its nud) and, when it
 * appears in infix position, how to extend the expression built so far (its
 * led). Comparing the next operator's left binding power with the caller's
 * right binding power decides whether to keep combining, which naturally
 * handles precedence and associativity without a grammar table.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n tokens
 *   Space: O(n) for the tokens and the resulting tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each completed subexpression is drawn as a tree of nodes and edges.
 *   - The most recently reduced node is highlighted at the root.
 *   - The final frame shows the full parse tree and its numeric value.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Token = { text: string; kind: "number" | "op" };
type Ast =
    | { kind: "number"; value: number; text: string }
    | { kind: "unary"; op: string; child: Ast }
    | { kind: "binary"; op: string; left: Ast; right: Ast };

const LEFT_BP: Record<string, number> = { "+": 10, "-": 10, "*": 20, "/": 20, "(": 0, ")": 0 };
const RIGHT_BP: Record<string, number> = { "+": 11, "-": 11, "*": 21, "/": 21 };
const PREFIX_BP = 30;

/** Split an expression into number and operator tokens, skipping stray characters. */
function tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < expr.length) {
        const c = expr[i] as string;
        if (c >= "0" && c <= "9") {
            let number = "";
            while (i < expr.length && expr[i] >= "0" && expr[i] <= "9") {
                number += expr[i];
                i += 1;
            }
            tokens.push({ text: number, kind: "number" });
        } else if ("+-*/()".includes(c)) {
            tokens.push({ text: c, kind: "op" });
            i += 1;
        } else {
            i += 1;
        }
    }
    return tokens;
}

/** Evaluate the parse tree, guarding against division by zero. */
function evaluate(node: Ast): number {
    switch (node.kind) {
        case "number":
            return node.value;
        case "unary":
            return -evaluate(node.child);
        case "binary": {
            const left = evaluate(node.left);
            const right = evaluate(node.right);
            if (node.op === "+") return left + right;
            if (node.op === "-") return left - right;
            if (node.op === "*") return left * right;
            return right === 0 ? 0 : left / right;
        }
    }
}

/** Render an expression tree with parentId metadata and directed edges. */
function tree(root: Ast, rootState: EntityState): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    let counter = 0;
    const label = (node: Ast): string => (node.kind === "number" ? node.text : node.op);
    const visit = (node: Ast, parentId: string, edgeLabel: string): string => {
        const id = `node-${counter}`;
        counter += 1;
        entities.push({
            id,
            type: "node",
            label: label(node),
            value: label(node),
            state: parentId === "root" ? rootState : "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId },
        } as VisualEntity);
        if (node.kind === "unary") visit(node.child, id, "operand");
        if (node.kind === "binary") {
            visit(node.left, id, "left");
            visit(node.right, id, "right");
        }
        if (parentId !== "root") {
            edges.push({
                id: `edge-${parentId}-${id}`,
                sourceId: parentId,
                targetId: id,
                label: edgeLabel,
                state: "idle",
                directed: true,
            } as VisualEdge);
        }
        return id;
    };
    visit(root, "root", "");
    return { entities, edges };
}

/** The Pratt parser generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { expr?: string } | null) ?? {};
    const expr = task.expr ?? "1 + 2 * 3 - 4";
    const tokens = tokenize(expr);
    const frames: VisualFrame[] = [];
    let step = 0;

    const emit = (
        root: Ast,
        description: string,
        codeLineNumber: number,
        rootState: EntityState,
        meta: VisualFrame["meta"],
    ): void => {
        const t = tree(root, rootState);
        frames.push({
            stepNumber: step,
            entities: t.entities,
            edges: t.edges,
            description,
            codeLineNumber,
            layout: "tree",
            meta,
        });
        step += 1;
    };

    let pos = 0;
    const peek = (): Token | undefined => tokens[pos];

    const nud = (token: Token): Ast => {
        if (token.kind === "number") {
            const node: Ast = { kind: "number", value: Number(token.text), text: token.text };
            emit(node, `Prefix parse: literal ${token.text}.`, 2, "comparing", { expr, token: token.text });
            return node;
        }
        if (token.text === "-") {
            const child = parseExpr(PREFIX_BP);
            const node: Ast = { kind: "unary", op: "-", child };
            emit(node, "Prefix parse: unary minus applied to its operand.", 2, "comparing", { expr, token: "-" });
            return node;
        }
        if (token.text === "(") {
            const inner = parseExpr(0);
            if (peek()?.text === ")") pos += 1;
            return inner;
        }
        const fallback: Ast = { kind: "number", value: 0, text: "0" };
        emit(fallback, "Unexpected token; treating it as zero.", 2, "error", { expr, token: token.text });
        return fallback;
    };

    const led = (left: Ast, token: Token): Ast => {
        const right = parseExpr(RIGHT_BP[token.text] ?? 11);
        const node: Ast = { kind: "binary", op: token.text, left, right };
        emit(node, `Infix reduce: combined ${token.text} with its right operand.`, 5, "highlight", {
            expr,
            token: token.text,
        });
        return node;
    };

    function parseExpr(rightBindingPower: number): Ast {
        const token = tokens[pos];
        pos += 1;
        let left = token ? nud(token) : ({ kind: "number", value: 0, text: "0" } as Ast);
        while (pos < tokens.length) {
            const next = peek();
            if (!next || next.kind !== "op" || next.text === ")" || next.text === "(") break;
            if ((LEFT_BP[next.text] ?? 0) <= rightBindingPower) break;
            pos += 1;
            left = led(left, next);
        }
        return left;
    }

    if (tokens.length > 0) {
        const root = parseExpr(0);
        const result = evaluate(root);
        emit(root, `Done. Expression evaluated to ${result}.`, 7, "sorted", {
            expr,
            result,
            tokens: tokens.map((t) => t.text),
            nodeCount: frames.length + 1,
        });
    } else {
        const fallback: Ast = { kind: "number", value: 0, text: "0" };
        emit(fallback, "Done. Empty expression evaluates to 0.", 7, "sorted", { expr, result: 0 });
    }

    for (const frame of frames) yield frame;
}

/** The Pratt parser module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Pratt parser assigns each operator a left and a right binding power. When an operator appears in the middle of an expression, the parser asks whether the next operator binds more tightly than the current right context; if it does, the parser recurses to build that tighter subexpression first. This one rule replaces a whole precedence table and makes precedence and associativity fall out naturally.",
        invariants: [
            "Every completed node is a valid parse tree for the tokens consumed so far.",
            "An operator is consumed as infix only when its left binding power exceeds the caller's right binding power.",
            "Right binding powers are one higher than left binding powers, giving left associativity.",
            "A parenthesized expression is parsed at binding power zero, so operators inside it are fully reduced before the group closes.",
        ],
        correctness:
            "The nud of a token builds the smallest complete expression starting at that token, and the led loop extends it only with operators whose left binding power exceeds the current right binding power. Because higher-precedence operators have larger binding powers, they are consumed in recursive calls before lower-precedence ones, so the tree respects precedence. Using right binding power one above left makes equal-precedence operators group to the left. By induction over tokens, the returned tree parses exactly the consumed prefix, and evaluating it gives the expression's value.",
        complexityRationale:
            "Tokenization scans the expression once. Each token is consumed exactly once, either as a prefix or as an infix operator, so parsing is O(n) time. The token list and the output tree both hold one entry per token, giving O(n) space.",
        uses: [
            "Expression parsers in interpreters, compilers, and calculators",
            "Extensible languages that add operators without rewriting a grammar",
            "Configuration and query languages with custom precedence rules",
        ],
        references: [
            "Pratt, Top Down Operator Precedence, 1973",
            "Aho et al., Compilers: Principles, Techniques, and Tools, Chapter 4",
        ],
        workedExample:
            "For 1 + 2 * 3 the parser reads 1, sees + with left binding power 10 and recurses with right binding power 11. Inside, it reads 2, sees * with left binding power 20 greater than 11, and combines 2 * 3 first. Returning to the outer loop it builds 1 + (2 * 3), yielding 7.",
    },
    id: "pratt-parser",
    name: "Pratt Parser",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { expr: "1 + 2 * 3 - 4" },
    visualType: "tree",
    run,
    pseudocode: [
        "tokenize the expression into numbers and operators",
        "assign each operator a left and right binding power",
        "build a prefix with a literal, unary minus, or a parenthesized group",
        "while the next operator binds more tightly than the right context",
        "consume it and parse its right operand with its right binding power",
        "combine the two sides into a binary node and repeat",
        "recursively evaluate the finished tree",
        "done: report the parse tree and its numeric value",
    ],
};

export default module;
