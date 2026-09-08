/**
 * shunting-yard-parse.ts – Shunting-Yard.
 * Tiny deterministic default; 5-15 frames.
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
        meta,
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
    yield F(snap(), "Empty output, empty operator stack.", 1);
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
        "Done.",
        4,
        { rpn: out.join(" ") },
    );
}

const module: AlgorithmModule = {
    id: "shunting-yard-parse",
    name: "Shunting-Yard",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { expr: "3+4*2" },
    visualType: "grid",
    run,
};

export default module;
