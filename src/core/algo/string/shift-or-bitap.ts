/**
 * shift-or-bitap.ts – Shift-Or Bitap.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n·m/w)", space: "O(σ)"
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
    const t = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = t.text ?? "ababcab";
    const pat = t.pattern ?? "abc";
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
    yield F(tx(text), `Shift-Or exact search for "${pat}".`, 0);
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    const mask = new Map<string, number>();
    for (const ch of new Set((text + pat).split(""))) {
        let bits = 0;
        for (let i = 0; i < m; i += 1) if (pat[i] !== ch) bits |= 1 << i;
        mask.set(ch, bits);
    }
    yield F(tx(text), `Bitmasks built for m=${m}.`, 1);
    step += 1;
    const matches: number[] = [];
    let D = ~0;
    const all = (1 << m) - 1;
    for (let i = 0; i < text.length; i += 1) {
        D = ((D << 1) | 1) & (mask.get(text[i] as string) ?? all) & ((1 << m) - 1 || -1);
        const hit = (D & (1 << (m - 1))) === 0;
        if (hit) matches.push(i - m + 1);
        if (i < 6 || hit) {
            const s = new Map<number, EntityState>([[i, hit ? "path" : "comparing"]]);
            yield F(
                tx(text, s),
                hit
                    ? `Match ending at ${i} (start ${i - m + 1}).`
                    : `State D updated at text[${i}].`,
                2,
                { matches: [...matches] },
            );
            step += 1;
        }
        if (step > 11) break;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let k = s0; k < s0 + m; k += 1) fin.set(k, "sorted");
    yield F(
        tx(text, fin),
        matches.length ? `Found at ${matches.join(", ")}.` : "No occurrence.",
        3,
        { matches },
    );
}

const module: AlgorithmModule = {
    id: "shift-or-bitap",
    name: "Shift-Or Bitap",
    category: "string",
    complexity: { time: "O(n·m/w)", space: "O(σ)" },
    defaultInput: { text: "ababcab", pattern: "abc" },
    visualType: "text",
    run,
};

export default module;
