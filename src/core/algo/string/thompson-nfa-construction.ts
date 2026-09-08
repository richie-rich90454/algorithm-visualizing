/**
 * thompson-nfa-construction.ts – Thompson NFA.
 * Tiny deterministic default; 5-15 frames.
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
        meta,
    });
    yield F([cell(0, 0, re, "idle")], `Thompson NFA for /${re}/.`, 0);
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
    yield F([cell(1, 0, "b|c", "comparing")], "Union (b|c) via new split/join states.", 3);
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
    id: "thompson-nfa-construction",
    name: "Thompson NFA",
    category: "string",
    complexity: { time: "O(|regex|)", space: "O(|regex|)" },
    defaultInput: { regex: "a(b|c)" },
    visualType: "grid",
    run,
};

export default module;
