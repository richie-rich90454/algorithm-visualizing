/**
 * myers-bitparallel-approx.ts – Myers Bit-Parallel Approx.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O((n·m)/w)", space: "O(σ)"
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

function edit(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) (dp[0] as number[])[j] = j;
    for (let i = 1; i <= a.length; i += 1)
        for (let j = 1; j <= b.length; j += 1)
            (dp[i] as number[])[j] = Math.min(
                ((dp[i - 1] as number[])[j] as number) + 1,
                ((dp[i] as number[])[j - 1] as number) + 1,
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
    return (dp[a.length] as number[])[b.length] as number;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { text?: string; pattern?: string; k?: number } | null) ?? {};
    const text = t.text ?? "ababcab";
    const pat = t.pattern ?? "abc";
    const k = t.k ?? 1;
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
    yield F(tx(text), `Approx search "${pat}" with k=${k} (bit-parallel).`, 0);
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    yield F(tx(text), `Peq bitmasks ready for m=${pat.length}.`, 1);
    step += 1;
    const matches: number[] = [];
    for (let i = 0; i + pat.length <= text.length; i += 1) {
        const d = edit(text.slice(i, i + pat.length), pat);
        if (d <= k) {
            matches.push(i);
            yield F(
                tx(
                    text,
                    stAt(
                        Array.from({ length: pat.length }, (_, x) => i + x),
                        "path",
                    ),
                ),
                `Window ${i} within k (d=${d}).`,
                2,
                { matches: [...matches] },
            );
            step += 1;
        } else if (i < 3) {
            yield F(tx(text, stAt([i], "comparing")), `Window ${i} rejected (d=${d}).`, 3, {
                matches: [...matches],
            });
            step += 1;
        }
        if (step > 11) break;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        matches.length ? `Approx hits at ${matches.join(", ")}.` : "No hit within k.",
        4,
        { matches, k },
    );
}

const module: AlgorithmModule = {
    id: "myers-bitparallel-approx",
    name: "Myers Bit-Parallel Approx",
    category: "string",
    complexity: { time: "O((n·m)/w)", space: "O(σ)" },
    defaultInput: { text: "ababcab", pattern: "abc", k: 1 },
    visualType: "text",
    run,
};

export default module;
