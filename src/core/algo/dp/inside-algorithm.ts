/**
 * inside-algorithm.ts - Inside Algorithm for a Probabilistic Context-Free Grammar
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The inside algorithm is the probabilistic version of CYK parsing. For a
 * grammar in Chomsky normal form it computes the inside probability of every
 * nonterminal over every substring: the total probability of all parse trees
 * that derive that substring from that nonterminal. Length-one spans come from
 * terminal rules; longer spans combine binary rules across every split point.
 * The answer is the inside probability of the start symbol over the whole word.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 * |G|) for a word of length n and grammar size |G|
 *   Space: O(n^2 * |NT|) for the inside probability table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The triangular grid shows inside probabilities of the start symbol.
 *   - Spans of the length just completed are YELLOW; earlier spans are GREEN.
 *   - meta carries the full table for every nonterminal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type TerminalRule = [string, string, number];
type BinaryRule = [string, string, string, number];
interface Grammar {
    terminals: TerminalRule[];
    binary: BinaryRule[];
    start: string;
}

const DEFAULT_GRAMMAR: Grammar = {
    terminals: [
        ["A", "a", 0.5],
        ["A", "b", 0.5],
        ["B", "a", 0.7],
        ["B", "b", 0.3],
    ],
    binary: [
        ["S", "A", "B", 0.6],
        ["S", "B", "A", 0.4],
    ],
    start: "S",
};

function makeCells(
    n: number,
    values: Map<string, number>,
    start: string,
    filledLength: number,
    activeLength: number,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const len = j - i + 1;
            let state: EntityState = "unvisited";
            if (j >= i && len <= filledLength) {
                state = len === activeLength ? "comparing" : "sorted";
            }
            const value = j >= i ? (values.get(`${i},${j},${start}`) ?? 0) : 0;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: j >= i ? value.toFixed(4) : "",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grammar?: Grammar; word?: string } | null) ?? {};
    const word = typeof task.word === "string" ? task.word : "aa";
    const grammar: Grammar = task.grammar && Array.isArray(task.grammar.terminals) && Array.isArray(task.grammar.binary)
        ? task.grammar
        : DEFAULT_GRAMMAR;
    const n = word.length;
    const nts: string[] = [];
    for (const [lhs] of grammar.terminals) {
        if (!nts.includes(lhs)) nts.push(lhs);
    }
    for (const [lhs, left, right] of grammar.binary) {
        for (const symbol of [lhs, left, right]) {
            if (!nts.includes(symbol)) nts.push(symbol);
        }
    }
    if (!nts.includes(grammar.start)) {
        nts.push(grammar.start);
    }

    const inside = new Map<string, number>();

    const flatInside = (): number[] => {
        const out = Array<number>(nts.length * n * n).fill(0);
        for (let nt = 0; nt < nts.length; nt += 1) {
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    out[nt * n * n + i * n + j] = inside.get(`${i},${j},${nts[nt]}`) ?? 0;
                }
            }
        }
        return out;
    };

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty word: there is no nonempty span to score.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n: 0, rows: 0, cols: 0, probability: 0, nts: nts.join(","), ntCount: nts.length, inside: [] },
        };
        return;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(n, inside, grammar.start, 0, -1),
        edges: [],
        description: `Inside algorithm on "${word}" with ${nts.length} nonterminal(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, rows: n, cols: n, probability: 0, nts: nts.join(","), ntCount: nts.length, inside: flatInside() },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const ch = word[i];
        for (const [lhs, terminal, probability] of grammar.terminals) {
            if (terminal === ch) {
                const key = `${i},${i},${lhs}`;
                inside.set(key, (inside.get(key) ?? 0) + probability);
            }
        }
    }
    yield {
        stepNumber: step,
        entities: makeCells(n, inside, grammar.start, 1, 1),
        edges: [],
        description: "Length-one spans scored from the terminal productions.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { n, rows: n, cols: n, probability: 0, nts: nts.join(","), ntCount: nts.length, inside: flatInside() },
    };
    step += 1;

    for (let length = 2; length <= n; length += 1) {
        for (let i = 0; i + length <= n; i += 1) {
            const j = i + length - 1;
            for (let k = i; k < j; k += 1) {
                for (const [lhs, left, right, probability] of grammar.binary) {
                    const leftProb = inside.get(`${i},${k},${left}`) ?? 0;
                    const rightProb = inside.get(`${k + 1},${j},${right}`) ?? 0;
                    if (leftProb === 0 || rightProb === 0) {
                        continue;
                    }
                    const key = `${i},${j},${lhs}`;
                    inside.set(key, (inside.get(key) ?? 0) + probability * leftProb * rightProb);
                }
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(n, inside, grammar.start, length, length),
            edges: [],
            description: `Spans of length ${length} combined over every split and binary rule.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { n, rows: n, cols: n, probability: 0, nts: nts.join(","), ntCount: nts.length, inside: flatInside() },
        };
        step += 1;
    }

    const probability = inside.get(`0,${n - 1},${grammar.start}`) ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(n, inside, grammar.start, n, -1),
        edges: [],
        description: `Probability that the start symbol derives "${word}" is ${probability.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, rows: n, cols: n, probability, nts: nts.join(","), ntCount: nts.length, inside: flatInside() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The inside algorithm asks how likely it is that a nonterminal generates a particular piece of the input. For a single character, terminal rules give the answer. For a longer piece, split it in two, ask what the left and right children can generate, and multiply by the probability of the rule that combines them. Summing over all splits and rules accounts for every possible parse tree.",
        invariants: [
            "The inside value for a nonterminal and span sums the probabilities of all parse trees for that span.",
            "A longer span only combines child spans strictly shorter than itself.",
            "Probabilities are nonnegative and never exceed one for a proper grammar.",
        ],
        correctness:
            "Induct on span length. A length-one span is correct by the terminal rules. For a longer span, any parse tree begins with one binary rule producing two children that cover a split of the span, so enumerating all rules and splits and multiplying child inside probabilities counts every tree exactly once. The start symbol over the full word therefore gives the probability that the grammar generates the word.",
        complexityRationale:
            "There are O(n^2) spans, each trying O(n) splits and every binary rule, for O(n^3 * |G|) time. The table holds one probability per nonterminal per span, O(n^2 * |NT|) space.",
        uses: [
            "Computing sentence probabilities under a probabilistic grammar",
            "Scoring candidates in statistical machine translation",
            "The E-step foundation of the inside-outside algorithm",
        ],
        references: [
            "Kasami, An Efficient Recognition and Syntax-Analysis Algorithm, 1966",
            "Manning and Schutze, Foundations of Statistical Natural Language Processing, Chapter 11",
        ],
        workedExample:
            "With rules S to A B at 0.6 and S to B A at 0.4, A to a at 0.5, and B to a at 0.7, the word aa has two parses. Their probabilities 0.21 and 0.14 sum to 0.35, which is the inside probability of S over the whole word.",
    },
    id: "inside-algorithm",
    name: "Inside Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(n^3 * |G|)", space: "O(n^2 * |NT|)" },
    defaultInput: { word: "aa" },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the nonterminals from the grammar rules",
        "initialize length-one spans from the terminal productions",
        "for each longer span length enumerate all spans of that length",
        "for each split and binary rule multiply the two child inside values",
        "add the weighted product to the parent span's inside value",
        "repeat until spans of the full word are computed",
        "done: report the start symbol's full-span probability",
    ],
};

export default module;
