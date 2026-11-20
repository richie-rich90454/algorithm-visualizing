/**
 * brzozowski-derivative.ts - Brzozowski Derivative of Regular Expressions
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Brzozowski derivative D_c(r) of a regular expression r with respect to a
 * character c is a new regular expression describing every string that remains
 * after consuming a leading c from a string in r. Repeated derivation consumes
 * a whole input string one character at a time; the string belongs to the
 * language exactly when the final expression is nullable (accepts the empty
 * string). Smart constructors simplify each derivative into a compact tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(|input| * |pattern|) with simplification
 *   Space: O(|pattern|) for the current derivative tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current regular expression is drawn as a tree of nodes and edges.
 *   - Each input character replaces the tree with its simplified derivative.
 *   - The root is highlighted while deriving and turns green on accept, red on reject.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Re =
    | { kind: "empty" }
    | { kind: "eps" }
    | { kind: "char"; char: string }
    | { kind: "union"; left: Re; right: Re }
    | { kind: "concat"; left: Re; right: Re }
    | { kind: "star"; child: Re };

const EMPTY: Re = { kind: "empty" };
const EPS: Re = { kind: "eps" };

function charNode(c: string): Re {
    return { kind: "char", char: c };
}
function unionOf(a: Re, b: Re): Re {
    if (a.kind === "empty") return b;
    if (b.kind === "empty") return a;
    if (a.kind === "char" && b.kind === "char" && a.char === b.char) return a;
    return { kind: "union", left: a, right: b };
}
function concatOf(a: Re, b: Re): Re {
    if (a.kind === "empty" || b.kind === "empty") return EMPTY;
    if (a.kind === "eps") return b;
    if (b.kind === "eps") return a;
    return { kind: "concat", left: a, right: b };
}
function starOf(a: Re): Re {
    if (a.kind === "empty" || a.kind === "eps") return EPS;
    if (a.kind === "star") return a;
    return { kind: "star", child: a };
}

/** A regular expression is nullable when it accepts the empty string. */
function nullable(r: Re): boolean {
    switch (r.kind) {
        case "empty":
            return false;
        case "eps":
            return true;
        case "char":
            return false;
        case "union":
            return nullable(r.left) || nullable(r.right);
        case "concat":
            return nullable(r.left) && nullable(r.right);
        case "star":
            return true;
    }
}

/** The Brzozowski derivative of r with respect to character c. */
function derive(r: Re, c: string): Re {
    switch (r.kind) {
        case "empty":
        case "eps":
            return EMPTY;
        case "char":
            return r.char === c ? EPS : EMPTY;
        case "union":
            return unionOf(derive(r.left, c), derive(r.right, c));
        case "concat":
            return unionOf(
                concatOf(derive(r.left, c), r.right),
                nullable(r.left) ? derive(r.right, c) : EMPTY,
            );
        case "star":
            return concatOf(derive(r.child, c), starOf(r.child));
    }
}

/** Parse a small regex grammar: literals, concatenation, union, star, and groups. */
function parsePattern(s: string): Re {
    let i = 0;
    const parseAlt = (): Re => {
        let result = parseSeq();
        while (s[i] === "|") {
            i += 1;
            result = unionOf(result, parseSeq());
        }
        return result;
    };
    const parseSeq = (): Re => {
        let result: Re | null = null;
        while (i < s.length && s[i] !== "|" && s[i] !== ")") {
            const next = parsePostfix();
            result = result === null ? next : concatOf(result, next);
        }
        return result ?? EPS;
    };
    const parsePostfix = (): Re => {
        let result = parseAtom();
        while (s[i] === "*") {
            i += 1;
            result = starOf(result);
        }
        return result;
    };
    const parseAtom = (): Re => {
        const current = s[i];
        if (current === "(") {
            i += 1;
            const inner = parseAlt();
            if (s[i] === ")") i += 1;
            return inner;
        }
        i += 1;
        return charNode(current ?? "");
    };
    return parseAlt();
}

function sizeOf(r: Re): number {
    switch (r.kind) {
        case "empty":
        case "eps":
        case "char":
            return 1;
        case "union":
        case "concat":
            return 1 + sizeOf(r.left) + sizeOf(r.right);
        case "star":
            return 1 + sizeOf(r.child);
    }
}

function labelOf(r: Re): string {
    switch (r.kind) {
        case "empty":
            return "empty";
        case "eps":
            return "epsilon";
        case "char":
            return r.char;
        case "union":
            return "|";
        case "concat":
            return "concat";
        case "star":
            return "*";
    }
}

/** Render a regular-expression tree with parentId metadata and directed edges. */
function tree(r: Re, rootState: EntityState): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    let counter = 0;
    const visit = (node: Re, parentId: string, edgeLabel: string): string => {
        const id = `node-${counter}`;
        counter += 1;
        entities.push({
            id,
            type: "node",
            label: labelOf(node),
            value: labelOf(node),
            state: parentId === "root" ? rootState : "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId },
        } as VisualEntity);
        if (node.kind === "union" || node.kind === "concat") {
            visit(node.left, id, "left");
            visit(node.right, id, "right");
        } else if (node.kind === "star") {
            visit(node.child, id, "body");
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
    visit(r, "root", "");
    return { entities, edges };
}

/** The Brzozowski derivative generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pattern?: string; input?: string } | null) ?? {};
    const pattern = task.pattern ?? "(ab|ac)*";
    const text = task.input ?? "abac";
    let current = parsePattern(pattern);
    let step = 0;

    const frame = (
        r: Re,
        description: string,
        codeLineNumber: number,
        rootState: EntityState,
        meta: VisualFrame["meta"],
    ): VisualFrame => {
        const t = tree(r, rootState);
        return {
            stepNumber: step,
            entities: t.entities,
            edges: t.edges,
            description,
            codeLineNumber,
            layout: "tree",
            meta,
        };
    };

    yield frame(
        current,
        `Brzozowski derivative of "${pattern}" testing "${text}".`,
        0,
        "comparing",
        { pattern, input: text, consumed: "", size: sizeOf(current) },
    );
    step += 1;

    let consumed = "";
    for (const c of text) {
        current = derive(current, c);
        consumed += c;
        if (step < 80) {
            yield frame(
                current,
                `Derivative by "${c}" consumed "${consumed}"; expression now has ${sizeOf(current)} node(s).`,
                6,
                "comparing",
                { pattern, input: text, consumed, size: sizeOf(current), nullable: nullable(current) },
            );
            step += 1;
        }
    }

    const accepted = nullable(current);
    yield frame(
        current,
        `Done. "${text}" is ${accepted ? "accepted" : "rejected"} by "${pattern}".`,
        7,
        accepted ? "sorted" : "error",
        { pattern, input: text, consumed, accepted, size: sizeOf(current) },
    );
}

/** The Brzozowski derivative module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Derivating a regular expression by a character asks what is left to match after that character is consumed. For a literal equal to the character the answer is epsilon, meaning nothing remains; otherwise it is the empty language. Union, concatenation, and repetition each have a short rule, so an entire input string can be tested by deriving one character at a time and checking whether the leftover expression can still accept nothing.",
        invariants: [
            "D_c(r) accepts exactly the strings w for which c followed by w is in r.",
            "A regular expression is nullable exactly when it accepts the empty string.",
            "Simplification removes empty branches and repeated stars without changing the accepted language.",
            "After consuming a prefix p, the current expression accepts the suffixes that complete a match of p.",
        ],
        correctness:
            "The derivative rules follow directly from the language definitions. For a union, consuming c must be possible in either branch; for a concatenation r s it is either c consumed from r, or (when r is nullable) c consumed from s; for r* the first repetition consumes c and the rest remains r*. By induction over the expression tree, D_c(r) accepts precisely the suffixes w with cw in the language of r. Applying the rule for every input character and testing nullability therefore accepts exactly the strings in the language.",
        complexityRationale:
            "One derivation walks the expression tree once, costing time proportional to its size; over an input of length L this is O(L times pattern size). Simplification keeps the tree compact, and only the current expression is stored, giving space proportional to the pattern size.",
        uses: [
            "Implementing regular-expression engines without building a nondeterministic automaton",
            "Incremental matching where input arrives one character at a time",
            "Teaching the algebraic structure of regular languages",
        ],
        references: [
            "Brzozowski, Derivatives of Regular Expressions, Journal of the ACM, 1964",
            "Owens, Temple, and Elliott, Regular-expression derivatives reexamined, 2009",
        ],
        workedExample:
            "For the pattern ab|ac and input ac, the first derivative by a simplifies to b|c. Deriving by c gives the empty language from b union epsilon from c, which simplifies to epsilon. Epsilon is nullable, so ac is accepted; deriving ab|ac by x would give the empty language and reject.",
    },
    id: "brzozowski-derivative",
    name: "Brzozowski Derivative",
    category: "string",
    complexity: { time: "O(|input| * |pattern|)", space: "O(|pattern|)" },
    defaultInput: { pattern: "(ab|ac)*", input: "abac" },
    visualType: "tree",
    run,
    pseudocode: [
        "parse the pattern into a regular-expression tree",
        "the empty expression is non-nullable and epsilon is nullable",
        "the derivative of c by c is epsilon, otherwise empty",
        "the derivative of a union is the union of the derivatives",
        "the derivative of r s is D(r)s plus nullable(r) D(s)",
        "the derivative of r star is D(r) r star",
        "consume each input character by deriving and simplifying",
        "done: accept when the final expression is nullable",
    ],
};

export default module;
