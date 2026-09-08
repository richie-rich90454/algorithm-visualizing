/**
 * ll1-table-parsing.ts – LL(1) Parsing.
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
    const s = t.input ?? "a+a";
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
    const toks = (s + "$").split("");
    yield F(
        toks.map((c, i) => cell(0, i, c, "idle")),
        `LL(1) parse "${s}" (E→aG, G→+E|ε).`,
        0,
    );
    step += 1;
    yield F(
        [cell(1, 0, "E→aG", "sorted"), cell(1, 1, "G→+E", "sorted"), cell(1, 2, "G→ε", "sorted")],
        "Table M[E,a], M[G,+], M[G,$] consulted.",
        1,
    );
    step += 1;
    const stack: string[] = ["$", "E"];
    let p = 0,
        ok = true;
    const snap = (): VisualEntity[] =>
        stack.map((x, i) => cell(2, i, x, i === stack.length - 1 ? "comparing" : "idle"));
    yield F(snap(), `Stack [${stack.join(" ")}], input "${toks.slice(p).join("")}".`, 2);
    step += 1;
    let guard = 0;
    while (stack.length > 0 && guard < 4) {
        guard += 1;
        const top = stack.pop() as string;
        const look = toks[p] as string;
        if (top === look) {
            p += 1;
            yield F(snap(), `Match "${look}".`, 2);
            step += 1;
        } else if (top === "E" && look === "a") {
            stack.push("G");
            stack.push("a");
            yield F(snap(), "Expand E→aG.", 2);
            step += 1;
        } else if (top === "G" && look === "+") {
            stack.push("E");
            stack.push("+");
            yield F(snap(), "Expand G→+E.", 2);
            step += 1;
        } else if (top === "G" && look === "$") {
            yield F(snap(), "Expand G→ε.", 2);
            step += 1;
        } else {
            ok = false;
            break;
        }
    }
    ok = ok && p === toks.length;
    yield F(
        [cell(3, 0, ok ? "ACCEPT" : "REJECT", ok ? "path" : "swapped")],
        ok ? "Input consumed: ACCEPT." : "Error: REJECT.",
        3,
        { accept: ok },
    );
    step += 1;
    yield F([cell(3, 0, ok ? "ACCEPT" : "REJECT", "sorted")], "Done.", 4, { accept: ok });
}

const module: AlgorithmModule = {
    id: "ll1-table-parsing",
    name: "LL(1) Parsing",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { input: "a+a" },
    visualType: "grid",
    run,
};

export default module;
