/**
 * set-horspool-search.ts – Set Horspool
 *
 * Multi-pattern Horspool: one shared bad-character table over all
 * patterns drives the skips, and every alignment verifies each pattern
 * at the window before shifting.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function tx(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return [...text].map((ch, i) => ({
        id: `ch-${i}`,
        type: "character" as const,
        label: ch,
        value: ch,
        state: states.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; patterns?: string[] } | null) ?? {};
    const text = task.text ?? "ababcab";
    const patterns = (task.patterns ?? ["ab", "bc"]).filter((p) => p.length > 0);
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        code: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber: code,
        layout: "text",
        meta: { comparisons: 0, matches: [], ...meta },
    });

    yield F(tx(text), `Set Horspool over ${patterns.length} pattern(s).`, 0, {
        comparisons: 0,
        hits: [],
    });
    step += 1;
    if (patterns.length === 0 || text.length === 0) {
        yield F(tx(text), "Nothing to search – empty text or pattern set.", 1, {
            comparisons: 0,
            hits: [],
        });
        return;
    }
    const m = Math.min(...patterns.map((p) => p.length));
    const shift = new Map<string, number>();
    for (const pat of patterns) {
        for (let i = 0; i < pat.length - 1; i += 1) {
            const ch = pat[i] ?? "";
            const s = Math.min(m - 1 - Math.min(i, m - 1), m - 1);
            const cur = shift.get(ch);
            if (cur === undefined || s < cur) {
                shift.set(ch, Math.max(1, s));
            }
        }
    }
    const table = [...shift.entries()].map(([c, s]) => `${c}:${s}`).join(" ");
    yield F(tx(text), `Shared shift table (min length ${m}): ${table || "(all full shifts)"}.`, 1, {
        comparisons: 0,
        shifts: shift.size,
    });
    step += 1;

    const hits: Array<{ pat: string; pos: number }> = [];
    let comparisons = 0;
    let pos = 0;
    while (pos + m <= text.length) {
        const window = new Map<number, EntityState>();
        for (let k = pos; k < pos + m; k += 1) {
            window.set(k, "comparing");
        }
        comparisons += patterns.length;
        const found: string[] = [];
        for (const pat of patterns) {
            if (text.slice(pos, pos + pat.length) === pat) {
                found.push(pat);
                hits.push({ pat, pos });
            }
        }
        yield F(
            tx(text, window),
            found.length > 0
                ? `Alignment ${pos}: matched ${found.map((p) => `"${p}"`).join(", ")}.`
                : `Alignment ${pos}: no pattern matches here.`,
            2,
            { comparisons, pos },
        );
        step += 1;
        const last = text[pos + m - 1] ?? "";
        pos += shift.get(last) ?? m;
    }
    const fin = new Map<number, EntityState>();
    for (const h of hits) {
        for (let x = h.pos; x < h.pos + h.pat.length; x += 1) {
            fin.set(x, "sorted");
        }
    }
    const hitStr = hits.map((h) => `${h.pat}@${h.pos}`);
    yield F(
        tx(text, fin),
        hits.length > 0 ? `${hits.length} hit(s): ${hitStr.join(", ")}.` : "No hits.",
        3,
        {
            comparisons,
            shifts: shift.size,
            hits: hitStr,
        },
    );
}

const module: AlgorithmModule = {
    id: "set-horspool-search",
    name: "Set Horspool",
    category: "string",
    complexity: { time: "O(n + m) average", space: "O(patterns)" },
    defaultInput: { text: "ababcab", patterns: ["ab", "bc"] },
    visualType: "text",
    run,
    pseudocode: [
        "build shared shift table over all patterns",
        "align window using minimum pattern length",
        "compare each pattern against current window",
        "record every pattern matching at alignment",
        "shift by shared table value of window end",
        "repeat until window exceeds text bounds",
        "report all pattern hits with positions",
    ],
};

export default module;
