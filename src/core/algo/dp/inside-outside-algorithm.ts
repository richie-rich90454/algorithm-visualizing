/**
 * inside-outside-algorithm.ts - Inside-Outside Algorithm for a PCFG
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The inside-outside algorithm trains a probabilistic context-free grammar
 * from unannotated strings. It computes inside probabilities (derivations of a
 * span from a nonterminal) and outside probabilities (contexts around that
 * span), then combines them into expected counts for each grammar rule. One
 * expectation-maximization iteration renormalizes those counts into new rule
 * probabilities that make the observed word more likely.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^3 * |G|) for a word of length n
 *   Space: O(n^2 * |NT|) for the inside and outside tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows inside values, then outside values, for the start symbol.
 *   - The active span length is YELLOW; finished lengths are GREEN.
 *   - meta carries both tables and the re-estimated grammar.
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
    symbol: string,
    filledLength: number,
    activeLength: number,
    mode: "inside" | "outside",
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const len = j - i + 1;
            let state: EntityState = "unvisited";
            if (j >= i && len <= filledLength) {
                state = len === activeLength ? "comparing" : "sorted";
            }
            const value = j >= i ? (values.get(`${i},${j},${symbol}`) ?? 0) : 0;
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
                metadata: { row: i, col: j, mode },
            });
        }
    }
    return cells;
}

interface Passes {
    inside: Map<string, number>;
    outside: Map<string, number>;
    probability: number;
    binaryCounts: number[];
    terminalCounts: number[];
}

function computePasses(grammar: Grammar, word: string, nts: string[]): Passes {
    const n = word.length;
    const inside = new Map<string, number>();
    const getIn = (i: number, j: number, symbol: string): number => inside.get(`${i},${j},${symbol}`) ?? 0;

    for (let i = 0; i < n; i += 1) {
        for (const [lhs, terminal, probability] of grammar.terminals) {
            if (terminal === word[i]) {
                const key = `${i},${i},${lhs}`;
                inside.set(key, (inside.get(key) ?? 0) + probability);
            }
        }
    }
    for (let length = 2; length <= n; length += 1) {
        for (let i = 0; i + length <= n; i += 1) {
            const j = i + length - 1;
            for (let k = i; k < j; k += 1) {
                for (const [lhs, left, right, probability] of grammar.binary) {
                    const lp = getIn(i, k, left);
                    const rp = getIn(k + 1, j, right);
                    if (lp === 0 || rp === 0) {
                        continue;
                    }
                    const key = `${i},${j},${lhs}`;
                    inside.set(key, (inside.get(key) ?? 0) + probability * lp * rp);
                }
            }
        }
    }
    const probability = getIn(0, n - 1, grammar.start);

    const outside = new Map<string, number>();
    if (n > 0 && probability > 0) {
        outside.set(`0,${n - 1},${grammar.start}`, 1);
        const getOut = (i: number, j: number, symbol: string): number => outside.get(`${i},${j},${symbol}`) ?? 0;
        const setOut = (i: number, j: number, symbol: string, value: number): void => {
            outside.set(`${i},${j},${symbol}`, value);
        };
        for (let length = n; length >= 1; length -= 1) {
            for (let i = 0; i + length <= n; i += 1) {
                const j = i + length - 1;
                for (const symbol of nts) {
                    let value = getOut(i, j, symbol);
                    for (const [parent, left, right, ruleProb] of grammar.binary) {
                        if (left === symbol) {
                            for (let k = j + 1; k < n; k += 1) {
                                value += ruleProb * getOut(i, k, parent) * getIn(j + 1, k, right);
                            }
                        }
                        if (right === symbol) {
                            for (let k = 0; k < i; k += 1) {
                                value += ruleProb * getOut(k, j, parent) * getIn(k, i - 1, left);
                            }
                        }
                    }
                    setOut(i, j, symbol, value);
                }
            }
        }
    }

    const safe = probability > 0 ? probability : Number.MIN_VALUE;
    const binaryCounts = grammar.binary.map(([lhs, left, right, ruleProb]) => {
        let expected = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i; j < n; j += 1) {
                const outer = outside.get(`${i},${j},${lhs}`) ?? 0;
                if (outer === 0) {
                    continue;
                }
                for (let k = i; k < j; k += 1) {
                    expected += outer * getIn(i, k, left) * getIn(k + 1, j, right);
                }
            }
        }
        return (ruleProb * expected) / safe;
    });
    const terminalCounts = grammar.terminals.map(([lhs, terminal, ruleProb]) => {
        let expected = 0;
        for (let i = 0; i < n; i += 1) {
            if (word[i] === terminal) {
                expected += outside.get(`${i},${i},${lhs}`) ?? 0;
            }
        }
        return (ruleProb * expected) / safe;
    });

    return { inside, outside, probability, binaryCounts, terminalCounts };
}

/** Turn expected rule counts into a renormalized grammar. */
function reestimate(grammar: Grammar, counts: Passes): Grammar {
    const totalByLhs = new Map<string, number>();
    grammar.binary.forEach(([lhs], index) => {
        totalByLhs.set(lhs, (totalByLhs.get(lhs) ?? 0) + (counts.binaryCounts[index] ?? 0));
    });
    grammar.terminals.forEach(([lhs], index) => {
        totalByLhs.set(lhs, (totalByLhs.get(lhs) ?? 0) + (counts.terminalCounts[index] ?? 0));
    });
    const scale = (lhs: string, count: number, fallback: number): number => {
        const total = totalByLhs.get(lhs) ?? 0;
        return total > 0 ? count / total : fallback;
    };
    return {
        start: grammar.start,
        terminals: grammar.terminals.map(([lhs, ch, oldProb], index) =>
            [lhs, ch, scale(lhs, counts.terminalCounts[index] ?? 0, oldProb)] as TerminalRule,
        ),
        binary: grammar.binary.map(([lhs, left, right, oldProb], index) =>
            [lhs, left, right, scale(lhs, counts.binaryCounts[index] ?? 0, oldProb)] as BinaryRule,
        ),
    };
}

function flatTable(values: Map<string, number>, nts: string[], n: number): number[] {
    const out = Array<number>(nts.length * n * n).fill(0);
    for (let nt = 0; nt < nts.length; nt += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                out[nt * n * n + i * n + j] = values.get(`${i},${j},${nts[nt]}`) ?? 0;
            }
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grammar?: Grammar; word?: string; iterations?: number } | null) ?? {};
    const word = typeof task.word === "string" ? task.word : "ab";
    let grammar: Grammar = task.grammar && Array.isArray(task.grammar.terminals) && Array.isArray(task.grammar.binary)
        ? task.grammar
        : DEFAULT_GRAMMAR;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 1;
    const n = word.length;
    const nts: string[] = [];
    for (const [lhs] of grammar.terminals) if (!nts.includes(lhs)) nts.push(lhs);
    for (const [lhs, left, right] of grammar.binary) {
        for (const symbol of [lhs, left, right]) if (!nts.includes(symbol)) nts.push(symbol);
    }
    if (!nts.includes(grammar.start)) nts.push(grammar.start);

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty word: there is no span to score or re-estimate.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n: 0, rows: 0, cols: 0, probability: 0 },
        };
        return;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(n, new Map(), grammar.start, 0, -1, "inside"),
        edges: [],
        description: `Inside-outside training on "${word}" for ${iterations} iteration(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, rows: n, cols: n, probability: 0, nts: nts.join(","), ntCount: nts.length },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const passes = computePasses(grammar, word, nts);

        if (iteration === 1) {
            yield {
                stepNumber: step,
                entities: makeCells(n, passes.inside, grammar.start, n, -1, "inside"),
                edges: [],
                description: "Inside pass: summed the probabilities of all parse trees per span.",
                codeLineNumber: 1,
                layout: "grid",
                meta: {
                    n, rows: n, cols: n, iteration, mode: "inside", probability: passes.probability,
                    nts: nts.join(","), ntCount: nts.length, inside: flatTable(passes.inside, nts, n),
                },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeCells(n, passes.outside, grammar.start, n, -1, "outside"),
                edges: [],
                description: "Outside pass: summed the probability of contexts around each span.",
                codeLineNumber: 3,
                layout: "grid",
                meta: {
                    n, rows: n, cols: n, iteration, mode: "outside", probability: passes.probability,
                    nts: nts.join(","), ntCount: nts.length, outside: flatTable(passes.outside, nts, n),
                },
            };
            step += 1;
        }

        grammar = reestimate(grammar, passes);
        yield {
            stepNumber: step,
            entities: makeCells(n, passes.outside, grammar.start, n, -1, "outside"),
            edges: [],
            description: `Iteration ${iteration} re-estimated rule probabilities from expected counts; word probability ${passes.probability.toFixed(6)}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: {
                n, rows: n, cols: n, iteration, mode: "reestimate", probability: passes.probability,
                nts: nts.join(","), ntCount: nts.length,
                binaryCounts: passes.binaryCounts, terminalCounts: passes.terminalCounts,
                newTerminals: grammar.terminals.map(([lhs, ch, p]) => `${lhs},${ch},${p.toFixed(6)}`),
                newBinary: grammar.binary.map(([lhs, left, right, p]) => `${lhs},${left},${right},${p.toFixed(6)}`),
            },
        };
        step += 1;
    }

    const finalPass = computePasses(grammar, word, nts);
    yield {
        stepNumber: step,
        entities: makeCells(n, finalPass.inside, grammar.start, n, -1, "inside"),
        edges: [],
        description: `Trained for ${iterations} iteration(s); final word probability ${finalPass.probability.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            n, rows: n, cols: n, iteration: iterations, mode: "final", probability: finalPass.probability,
            nts: nts.join(","), ntCount: nts.length,
            newTerminals: grammar.terminals.map(([lhs, ch, p]) => `${lhs},${ch},${p.toFixed(6)}`),
            newBinary: grammar.binary.map(([lhs, left, right, p]) => `${lhs},${left},${right},${p.toFixed(6)}`),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Inside probabilities say how a nonterminal can generate a span; outside probabilities say how the rest of the sentence can be generated around that span. Multiplying the two tells us how much each span contributes overall. From those contributions we count how often each grammar rule was likely used, then normalize the counts into fresh probabilities. Repeating makes the unlabeled training word more likely under the grammar.",
        invariants: [
            "Inside and outside values are nonnegative for every nonterminal and span.",
            "For a proper grammar the expected counts of all rules sharing a left-hand side sum to one.",
            "Renormalizing expected counts never decreases the probability of the observed word.",
        ],
        correctness:
            "The inside pass enumerates all derivations of each span by dynamic programming. The outside pass, processed from longer to shorter spans, sums the probability of every context in which a span appears. The product of inside and outside, divided by the word probability, is the posterior probability of that span being that nonterminal. Summing it over splits gives each rule's expected count, and maximizing the expected complete-data likelihood yields the EM update, which cannot lower the word probability.",
        complexityRationale:
            "Inside and outside both visit O(n^2) spans with O(n) splits and grammar-size work, so one iteration costs O(n^3 * |G|). The two tables hold O(n^2 * |NT|) values, and rule counts add space linear in the grammar size.",
        uses: [
            "Inducing grammars from unlabeled text in computational linguistics",
            "Learning stochastic grammars for speech and language modeling",
            "Unsupervised parsing and syntactic structure discovery",
        ],
        references: [
            "Baker, Trainable Grammars for Speech Recognition, 1979",
            "Lari and Young, The Estimation of Stochastic Context-Free Grammars, 1990",
            "Manning and Schutze, Foundations of Statistical Natural Language Processing, Chapter 11",
        ],
        workedExample:
            "With S producing A B or B A, A producing a or b equally, and B favoring a, the word ab has two parses. Inside computes each parse probability; outside distributes the surrounding context back to the leaves. The expected rule counts then shift A and B toward the letters they actually explained, raising the probability of ab.",
    },
    id: "inside-outside-algorithm",
    name: "Inside-Outside Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(iterations * n^3 * |G|)", space: "O(n^2 * |NT|)" },
    defaultInput: { word: "ab", iterations: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "compute inside probabilities for every nonterminal and span",
        "set the outside probability of the start symbol over the full word to one",
        "for spans from longest to shortest sum contributions from parent spans",
        "accumulate expected counts for binary and terminal rules",
        "divide each rule count by the total for its left-hand side",
        "repeat the passes with the new probabilities",
        "done: report the trained grammar and word probability",
    ],
};

export default module;
