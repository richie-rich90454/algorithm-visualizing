/**
 * hopcroft-dfa-minimization.ts – Hopcroft Minimization.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n log n)", space: "O(n)"
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
    const delta: Record<number, Record<string, number>> = {
        0: { a: 1, b: 0 },
        1: { a: 3, b: 0 },
        2: { a: 3, b: 0 },
        3: { a: 3, b: 0 },
    };
    const finals = new Set([3]);
    yield F(
        [0, 1, 2, 3].map((s, i) => cell(0, i, `q${s}`, finals.has(s) ? "highlight" : "idle")),
        "DFA: Q={0..3}, F={3}. States 1,2 look alike.",
        0,
    );
    step += 1;
    let P: number[][] = [[0, 1, 2], [3]];
    yield F(
        P.map((b, i) => cell(1, i, `{${b.join(",")}}`, "sorted")),
        "P0 = non-finals | finals.",
        1,
    );
    step += 1;
    const sig = (s: number, part: number[][]): string => {
        const d = delta[s] as Record<string, number>;
        return ["a", "b"].map((c) => part.findIndex((b) => b.includes(d[c] as number))).join(",");
    };
    let refined = true;
    while (refined) {
        refined = false;
        const nP: number[][] = [];
        for (const b of P) {
            const groups = new Map<string, number[]>();
            for (const s of b) {
                const k = sig(s, P);
                if (!groups.has(k)) groups.set(k, []);
                (groups.get(k) as number[]).push(s);
            }
            for (const g of groups.values()) nP.push(g);
            if (groups.size > 1) refined = true;
        }
        P = nP;
        if (refined && step < 10) {
            yield F(
                P.map((b, i) => cell(2, i, `{${b.join(",")}}`, "comparing")),
                `Split: ${P.map((b) => `{${b.join(",")}}`).join(" ")}.`,
                2,
            );
            step += 1;
        }
    }
    yield F(
        P.map((b, i) => cell(3, i, `{${b.join(",")}}`, "path")),
        `Stable: ${P.map((b) => `{${b.join(",")}}`).join(" ")}.`,
        3,
        { blocks: P.length },
    );
    step += 1;
    yield F(
        [cell(4, 0, `${P.length} states`, "sorted")],
        `Minimized: merged 1≡2 → ${P.length} states.`,
        4,
        { blocks: P.length, merged: [1, 2] },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "DFA minimization merges states that cannot be distinguished by any input string. Hopcroft's algorithm starts with the final and non-final blocks and repeatedly splits a block using a splitter symbol and a known distinguishing block, choosing the smaller side of each split to keep the worklist small.",
        "invariants": [
            "States in the same current block are equivalent with respect to all symbols processed so far.",
            "Any two blocks in the partition are distinguishable by some string, so merging within a block never merges different behaviors."
        ],
        "correctness": "Splitting by which block a transition on symbol a lands in separates exactly the states that behave differently on a. Processing all splitters to a fixed point yields the coarsest stable partition, which by the Myhill-Nerode theorem is the state set of the minimal DFA.",
        "complexityRationale": "Each state moves to a smaller block at most O(log n) times because the smaller half of a split becomes the new splitter, giving O(n log n) time for a constant alphabet. Space is O(n) for blocks and the worklist.",
        "uses": [
            "Minimizing lexer and parser automata",
            "Optimizing regular-expression engines",
            "Shrinking state machines in model checking"
        ],
        "references": [
            "Hopcroft, An n log n Algorithm for Minimizing States in a Finite Automaton, 1971",
            "Sipser, Introduction to the Theory of Computation, DFA chapter"
        ],
        "workedExample": "With states 0 through 3, final {3}, and transitions that make states 1 and 2 behave identically, the algorithm starts from {0,1,2} and {3}, finds no further split, merges 1 with 2, and leaves three minimal states."
    },
    id: "hopcroft-dfa-minimization",
    name: "Hopcroft Minimization",
    category: "string",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {},
    visualType: "grid",
    run,
    pseudocode: [
        "partition states into accepting and non-accepting blocks",
        "initialize worklist with smaller initial block",
        "split blocks by predecessor behavior on each symbol",
        "replace split blocks and update worklist",
        "repeat until worklist empties with stable partition",
        "merge equivalent states within each block",
        "report minimized automaton blocks",
    ],
};

export default module;
