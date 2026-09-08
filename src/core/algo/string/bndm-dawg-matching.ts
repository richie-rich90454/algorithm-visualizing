/**
 * bndm-dawg-matching.ts – BNDM.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(nm) worst, O(n/m) avg", space: "O(m·σ)"
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
    const pat = t.pattern ?? "cab";
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
    yield F(tx(text), `BNDM backward scan for "${pat}".`, 0);
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    yield F(tx(text), `Suffix-automaton masks for m=${m}.`, 1);
    step += 1;
    const matches: number[] = [];
    let pos = 0;
    while (pos <= text.length - m) {
        let D = ~0,
            last = -1,
            j = m - 1;
        while (j >= 0) {
            let s = 0;
            for (let i = 0; i < m; i += 1) if (pat[m - 1 - i] === text[pos + j]) s |= 1 << i;
            D = (D << 1) & s;
            if (D === 0) break;
            if ((D & (1 << (m - 1))) !== 0) last = j;
            j -= 1;
        }
        let ok = last >= 0 && text.slice(pos, pos + m) === pat;
        if (ok) {
            matches.push(pos);
            yield F(
                tx(
                    text,
                    stAt(
                        Array.from({ length: m }, (_, x) => pos + x),
                        "path",
                    ),
                ),
                `Match at ${pos}.`,
                2,
                { matches: [...matches] },
            );
            step += 1;
        } else {
            yield F(
                tx(text, stAt([pos], "comparing")),
                `Window ${pos} scanned backward, no match.`,
                3,
                { matches: [...matches] },
            );
            step += 1;
        }
        pos += last >= 0 ? m - last - 1 || 1 : m;
        if (step > 11 || pos > text.length - m) break;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + m; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        matches.length ? `Found at ${matches.join(", ")}.` : "No occurrence.",
        4,
        { matches },
    );
}

const module: AlgorithmModule = {
    id: "bndm-dawg-matching",
    name: "BNDM",
    category: "string",
    complexity: { time: "O(nm) worst, O(n/m) avg", space: "O(m·σ)" },
    defaultInput: { text: "ababcab", pattern: "cab" },
    visualType: "text",
    run,
};

export default module;
