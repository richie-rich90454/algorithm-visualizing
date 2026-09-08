/**
 * byte-pair-encoding-tokenization.ts – BPE Tokenization.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n) per merge", space: "O(n)"
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
    const t = (input as { text?: string } | null) ?? {};
    const text = t.text ?? "aaabdaaabac";
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
    yield F(tx(text), `BPE tokenize "${text}" (2 merges).`, 0);
    step += 1;
    let toks = text.split("");
    yield F(tx(toks.join(" ")), `Start: ${toks.length} char tokens.`, 1);
    step += 1;
    const merges: string[] = [];
    for (let round = 0; round < 2; round += 1) {
        const freq = new Map<string, number>();
        for (let i = 0; i + 1 < toks.length; i += 1) {
            const p = `${toks[i]}+${toks[i + 1]}`;
            freq.set(p, (freq.get(p) ?? 0) + 1);
        }
        let best = "",
            bn = 0;
        for (const [p, n] of freq)
            if (n > bn) {
                bn = n;
                best = p;
            }
        if (!best) break;
        merges.push(best);
        const [x, y] = best.split("+");
        const next: string[] = [];
        for (let i = 0; i < toks.length; i += 1) {
            if (toks[i] === x && toks[i + 1] === y) {
                next.push((x as string) + (y as string));
                i += 1;
            } else next.push(toks[i] as string);
        }
        toks = next;
        yield F(tx(toks.join(" ")), `Merge "${best}" (×${bn}): ${toks.length} tokens.`, 2, {
            toks: [...toks],
        });
        step += 1;
    }
    yield F(tx(toks.join(" ")), `Tokens: [${toks.join(" | ")}].`, 3, { toks });
    step += 1;
    yield F(tx(toks.join(" ")), "Done.", 4, { toks, merges });
}

const module: AlgorithmModule = {
    id: "byte-pair-encoding-tokenization",
    name: "BPE Tokenization",
    category: "string",
    complexity: { time: "O(n) per merge", space: "O(n)" },
    defaultInput: { text: "aaabdaaabac" },
    visualType: "text",
    run,
};

export default module;
