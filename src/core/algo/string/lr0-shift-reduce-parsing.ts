/**
 * lr0-shift-reduce-parsing.ts – LR(0) Parsing.
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
    const t = (input as { input?: string } | null) ?? {};
    const s = t.input ?? "aaa";
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
    yield F(
        s.split("").map((c, i) => cell(0, i, c, "idle")),
        `LR(0) shift-reduce "${s}" (S→aS|a).`,
        0,
    );
    step += 1;
    const stack: string[] = [];
    let p = 0;
    const snap = (): VisualEntity[] => [
        ...stack.map((x, i) => cell(1, i, x, "sorted")),
        ...s
            .slice(p)
            .split("")
            .map((x, i) => cell(2, i, x, "idle")),
    ];
    yield F(snap(), "Empty stack, full input.", 1);
    step += 1;
    let guard = 0;
    while (p < s.length && guard < 3) {
        guard += 1;
        stack.push(s[p] as string);
        p += 1;
        yield F(snap(), `Shift "${stack[stack.length - 1]}".`, 2);
        step += 1;
    }
    yield F(snap(), "Reduce S→a / S→aS up the stack.", 3);
    step += 1;
    const accept = stack.length === s.length && stack.every((x) => x === "a");
    yield F(
        [cell(3, 0, accept ? "ACCEPT" : "REJECT", accept ? "path" : "swapped")],
        accept ? "Reduced to S: ACCEPT." : "REJECT.",
        4,
        { accept },
    );
    step += 1;
    yield F([cell(3, 0, accept ? "ACCEPT" : "REJECT", "sorted")], "Done.", 5, { accept });
}

const module: AlgorithmModule = {
    id: "lr0-shift-reduce-parsing",
    name: "LR(0) Parsing",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { input: "aaa" },
    visualType: "grid",
    run,
};

export default module;
