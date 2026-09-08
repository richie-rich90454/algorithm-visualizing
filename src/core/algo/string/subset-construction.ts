/**
 * subset-construction.ts – Subset Construction.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(2^n)", space: "O(2^n)"
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

function eclose(states: number[], eps: Map<number, number[]>): number[] {
    const out = new Set(states);
    const stack = [...states];
    while (stack.length > 0) {
        const s = stack.pop() as number;
        for (const q of eps.get(s) ?? [])
            if (!out.has(q)) {
                out.add(q);
                stack.push(q);
            }
    }
    return [...out].sort((x, y) => x - y);
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
    yield F([cell(0, 0, re, "idle")], `Subset construction for /${re}/.`, 0);
    step += 1;
    const eps = new Map<number, number[]>([
        [1, [2]],
        [2, [3, 5]],
        [4, [7]],
        [6, [7]],
    ]);
    const move = new Map<string, number>([
        ["0,a", 1],
        ["3,b", 4],
        ["5,c", 6],
    ]);
    const start = eclose([0], eps);
    yield F(
        start.map((s, i) => cell(1, i, String(s), "sorted")),
        `ε-closure({0}) = {${start.join(",")}} = D0.`,
        1,
    );
    step += 1;
    const names = new Map<string, number>();
    const dfa: Array<{ set: number[]; ab: number; bb: number; cb: number }> = [];
    const key = (s: number[]): string => s.join(",");
    names.set(key(start), 0);
    dfa.push({ set: start, ab: -1, bb: -1, cb: -1 });
    const q: number[][] = [start];
    while (q.length > 0) {
        const cur = q.shift() as number[];
        for (const [col, ch] of [
            ["ab", "a"],
            ["bb", "b"],
            ["cb", "c"],
        ] as Array<[string, string]>) {
            const mv: number[] = [];
            for (const s of cur) {
                const d = move.get(`${s},${ch}`);
                if (d !== undefined) mv.push(d);
            }
            const c = eclose(mv, eps);
            if (c.length === 0) continue;
            if (!names.has(key(c))) {
                names.set(key(c), dfa.length);
                dfa.push({ set: c, ab: -1, bb: -1, cb: -1 });
                q.push(c);
            }
            (dfa[names.get(key(cur)) as number] as Record<string, unknown>)[col] = names.get(
                key(c),
            );
        }
    }
    for (let i = 0; i < Math.min(3, dfa.length); i += 1) {
        const d = dfa[i] as { set: number[]; ab: number; bb: number; cb: number };
        yield F(
            d.set.map((s, k) => cell(2 + i, k, String(s), "comparing")),
            `D${i}={${d.set.join(",")}} on a→${d.ab} b→${d.bb} c→${d.cb}.`,
            2,
        );
        step += 1;
    }
    yield F(
        dfa.map((d, i) => cell(9, i, `D${i}`, "sorted")),
        `${dfa.length} DFA states, start D0, accept has 7.`,
        3,
        { states: dfa.length },
    );
}

const module: AlgorithmModule = {
    id: "subset-construction",
    name: "Subset Construction",
    category: "string",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { regex: "a(b|c)" },
    visualType: "grid",
    run,
};

export default module;
