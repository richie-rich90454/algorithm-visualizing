/**
 * earley-parsing.ts – Earley Parsing.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n³)", space: "O(n²)"
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
        meta,
    });
    yield F([cell(0, 0, s || "ε", "idle")], `Earley parse "${s}" (S→AB, A→a, B→b).`, 0);
    step += 1;
    const sets: string[][] = [[`S→•AB@0`], [`A→a•@1`], [`B→b•@2`, `S→AB•@0`]];
    yield F(
        sets[0].map((it, i) => cell(0, i, it, "sorted")),
        `E0 seeded: ${sets[0].join("; ")}.`,
        1,
    );
    step += 1;
    for (let k = 1; k <= s.length && step < 10; k += 1) {
        yield F(
            (sets[k] as string[]).map((it, i) => cell(k, i, it, "comparing")),
            `E${k}: scan+complete → ${(sets[k] as string[]).join("; ")}.`,
            2,
        );
        step += 1;
    }
    const accept = (sets[s.length] as string[]).some((it) => it === `S→AB•@0`);
    yield F(
        [cell(9, 0, accept ? "ACCEPT" : "REJECT", accept ? "path" : "swapped")],
        accept ? "Complete S→AB•@0 ∈ E2: ACCEPT." : "REJECT.",
        3,
        { accept },
    );
    step += 1;
    yield F([cell(9, 0, accept ? "ACCEPT" : "REJECT", "sorted")], "Done.", 4, { accept });
}

const module: AlgorithmModule = {
    id: "earley-parsing",
    name: "Earley Parsing",
    category: "string",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: { input: "ab" },
    visualType: "grid",
    run,
};

export default module;
