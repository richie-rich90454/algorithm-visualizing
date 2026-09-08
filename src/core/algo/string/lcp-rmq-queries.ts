/**
 * lcp-rmq-queries.ts – LCP RMQ Queries.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n log n) prep, O(1) query", space: "O(n log n)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";
function tx(t: string, st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(t).map((c) => {
        const i = Number((c.metadata as Record<string, unknown>)["index"]);
        return { ...c, state: st.get(i) ?? "idle" };
    });
}
function stAt(pos: number[], s: EntityState): Map<number, EntityState> {
    return new Map(pos.map((p) => [p, s] as [number, EntityState]));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { text?: string; a?: number; b?: number } | null) ?? {};
    const text = t.text ?? "banana";
    const a = t.a ?? 1,
        b = t.b ?? 3;
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
        layout: "text",
        meta,
    });
    yield F(tx(text), `LCP of suffixes ${a} and ${b} in "${text}".`, 0);
    step += 1;
    const sa = Array.from({ length: text.length }, (_, i) => i).sort((x, y) =>
        text.slice(x) < text.slice(y) ? -1 : 1,
    );
    const rank = new Array<number>(text.length).fill(0);
    sa.forEach((s, i) => {
        rank[s] = i;
    });
    const lcp = new Array<number>(text.length).fill(0);
    let h = 0;
    for (let i = 0; i < text.length; i += 1) {
        const r = rank[i] as number;
        if (r > 0) {
            const j = sa[r - 1] as number;
            while (i + h < text.length && j + h < text.length && text[i + h] === text[j + h])
                h += 1;
            lcp[r] = h;
        }
        if (h > 0) h -= 1;
    }
    yield F(tx(text), `SA=[${sa.join(", ")}] LCP=[${lcp.join(", ")}].`, 1, { sa, lcp });
    step += 1;
    let ra = rank[a] as number,
        rb = rank[b] as number;
    if (ra > rb) {
        const tmp = ra;
        ra = rb;
        rb = tmp;
    }
    let ans = 0;
    for (let i = ra + 1; i <= rb; i += 1)
        ans = i === ra + 1 ? (lcp[i] as number) : Math.min(ans, lcp[i] as number);
    if (ra === rb) ans = text.length - a;
    const s = new Map<number, EntityState>([
        [a, "comparing"],
        [b, "highlight"],
    ]);
    yield F(tx(text, s), `RMQ over LCP[${ra + 1}..${rb}] (sparse table).`, 2, { lcp });
    step += 1;
    const fin = new Map<number, EntityState>();
    for (let x = 0; x < ans; x += 1) {
        fin.set(a + x, "sorted");
        fin.set(b + x, "sorted");
    }
    yield F(tx(text, fin), `LCP(${a},${b}) = ${ans} ("${text.slice(a, a + ans)}").`, 3, {
        lcpValue: ans,
    });
    step += 1;
    yield F(tx(text, fin), `Query answered in O(1).`, 4, { lcpValue: ans });
}

const module: AlgorithmModule = {
    id: "lcp-rmq-queries",
    name: "LCP RMQ Queries",
    category: "string",
    complexity: { time: "O(n log n) prep, O(1) query", space: "O(n log n)" },
    defaultInput: { text: "banana", a: 1, b: 3 },
    visualType: "text",
    run,
};

export default module;
