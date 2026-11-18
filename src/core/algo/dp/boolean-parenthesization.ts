/**
 * boolean-parenthesization.ts - Boolean Parenthesization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: T[i][j] <- sum over splits and ops of true combinations.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b3)
 *   Space: O(n\u00b2)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { symbols?: string; ops?: string } | null) ?? {};
    const symbols = typeof task.symbols === "string" ? task.symbols : "TFT";
    const ops = typeof task.ops === "string" ? task.ops : "|&";
    let step = 0;
    if (symbols.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No symbols \u2013 zero ways.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = symbols.length;
    const T: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const F: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        if (symbols[i] === "T") T[i][i] = 1;
        else F[i][i] = 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(T),
        edges: [],
        description: `Parenthesize "${symbols}" with ops "${ops}". True-table diagonal seeded.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(F),
        edges: [],
        description: `False-table diagonal seeded from single symbols.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len - 1 < n; i += 1) {
            const j = i + len - 1;
            let t = 0;
            let f = 0;
            for (let k = i; k < j; k += 1) {
                const op = ops[k] ?? "&";
                const tik = T[i]?.[k] ?? 0;
                const fik = F[i]?.[k] ?? 0;
                const tkj = T[k + 1]?.[j] ?? 0;
                const fkj = F[k + 1]?.[j] ?? 0;
                if (op === "|") {
                    t += tik * tkj + tik * fkj + fik * tkj;
                    f += fik * fkj;
                } else if (op === "&") {
                    t += tik * tkj;
                    f += fik * fkj + fik * tkj + tik * fkj;
                } else {
                    t += tik * fkj + fik * tkj;
                    f += tik * tkj + fik * fkj;
                }
            }
            T[i][j] = t;
            F[i][j] = f;
        }
        const states = new Map<string, EntityState>([[`0,${len - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(T, states),
            edges: [],
            description: `Length-${len} spans: T[0][${len - 1}] = ${T[0]?.[len - 1]}, F[0][${len - 1}] = ${F[0]?.[len - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = T[0]?.[n - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(T, new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} parenthesizations evaluate true.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Boolean parenthesization counts how many ways to insert parentheses in a chain of Boolean symbols and operators so the whole expression evaluates to true. Two tables track the number of ways each interval can yield true or false. For every split, the operator decides which combinations of left and right values produce the desired result.",
        "invariants": [
            "T[i][j] and F[i][j] count parenthesizations of symbols i..j yielding true and false.",
            "Single-symbol intervals have exactly one true or false way.",
            "For every split, the operator's truth table is applied to the left and right counts."
        ],
        "correctness": "Any parenthesization has a final operator splitting the interval into two sub-expressions, so enumerating all splits and operators covers every case exactly once. The truth table determines which left and right outcomes combine to the target value, and multiplying counts gives the number of combinations. Filling by increasing interval length makes subinterval counts final.",
        "complexityRationale": "There are O(n^2) intervals and O(n) splits per interval, each doing constant work, so time is O(n^3). The two tables occupy O(n^2) space.",
        "uses": [
            "Counting evaluations in Boolean expression analysis",
            "Probabilistic reasoning about uncertain logical formulas",
            "Dynamic programming over interval grammars"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Chapter 15",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6"
        ],
        "workedExample": "For symbols TFT with operators | and &, base intervals set T[0][0]=1 and F[1][1]=1. Splitting at the AND operator combines left and right counts to fill T[0][2], giving the number of parenthesizations that evaluate true."
    },
    id: "boolean-parenthesization",
    name: "Boolean Parenthesization",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b3)", space: "O(n\u00b2)" },
    defaultInput: { symbols: "TFT", ops: "|&" },
    visualType: "grid",
    run,
    pseudocode: [
        "set up T[i][i] and F[i][i] from single symbol values",
        "tables hold true-ways and false-ways per interval",
        "T[i][j] <- sum over splits and ops of true combinations",
        "F[i][j] <- sum over splits and ops of false combinations",
        "fill intervals by increasing length from 2 to n",
        "combine left and right counts per operator truth table",
        "answer <- T[0][n-1] with parenthesization from split choices",
    ],
};

export default module;
