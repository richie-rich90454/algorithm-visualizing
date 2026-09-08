/**
 * cyk-parsing.ts – CYK Parsing.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n³·|G|)", space: "O(n²)"
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
    yield F([cell(0, 0, s, "idle")], `CYK parse "${s}" (S→AB, A→a, B→b).`, 0);
    step += 1;
    const n = s.length;
    const T: Set<string>[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => new Set<string>()),
    );
    for (let i = 0; i < n; i += 1) {
        if (s[i] === "a") (T[i] as Set<string>[])[i].add("A");
        if (s[i] === "b") (T[i] as Set<string>[])[i].add("B");
    }
    const show = (upto: number): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1)
            for (let j = i; j < Math.min(n, i + upto); j += 1)
                out.push(cell(i, j, [...(T[i] as Set<string>[])[j]].join("") || "∅", "sorted"));
        return out;
    };
    yield F(show(1), "Length-1 cells from terminals.", 1);
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len <= n; i += 1) {
            const j = i + len - 1;
            for (let k = i; k < j; k += 1) {
                const L = (T[i] as Set<string>[])[k],
                    R = (T[k + 1] as Set<string>[])[j];
                if (L.has("A") && R.has("B")) (T[i] as Set<string>[])[j].add("S");
            }
        }
        yield F(show(len), `Spans of length ${len} combined.`, 2);
        step += 1;
    }
    const accept = (T[0] as Set<string>[])[n - 1].has("S");
    yield F(show(n), accept ? `S ∈ T[0][${n - 1}]: ACCEPT.` : "S missing: REJECT.", 3, { accept });
    step += 1;
    yield F(show(n), "Done.", 4, { accept });
}

const module: AlgorithmModule = {
    id: "cyk-parsing",
    name: "CYK Parsing",
    category: "string",
    complexity: { time: "O(n³·|G|)", space: "O(n²)" },
    defaultInput: { input: "ab" },
    visualType: "grid",
    run,
};

export default module;
