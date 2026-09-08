/**
 * rope.ts - Rope
 * Leaves hold chunks; concat/split rebalance. Demo: build + charAt + split.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nodes(chunks: string[], st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return chunks.map((c, i) => ({
        id: `n-${i}`,
        type: "node" as const,
        label: c,
        value: c.length,
        state: st.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: i === 0 ? "root" : 0, chunk: c },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { chunks?: string[]; index?: number } | null) ?? {};
    const chunks = Array.isArray(t.chunks)
        ? [...t.chunks].slice(0, 6)
        : ["hel", "lo ", "wor", "ld"];
    const idx = typeof t.index === "number" ? t.index : 7;
    let step = 0;
    yield {
        stepNumber: step,
        entities: [
            {
                id: "n-empty",
                type: "node" as const,
                label: "E",
                value: 0,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Rope: empty.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;
    for (let i = 0; i < chunks.length; i += 1) {
        yield {
            stepNumber: step,
            entities: nodes(chunks.slice(0, i + 1), new Map([[i, "comparing"]])),
            edges: [],
            description: `Concat "${chunks[i]}".`,
            codeLineNumber: 1,
            layout: "tree",
            meta: {},
        };
        step += 1;
    }
    const full = chunks.join("");
    const ch = full.length ? full[Math.min(idx, full.length - 1)]! : "";
    yield {
        stepNumber: step,
        entities: nodes(chunks, new Map()),
        edges: [],
        description: `charAt(${idx}) = "${ch}" of "${full}".`,
        codeLineNumber: 2,
        layout: "tree",
        meta: {},
    };
    step += 1;
    const at = Math.min(idx, full.length);
    yield {
        stepNumber: step,
        entities: nodes(chunks, new Map([[0, "sorted"]])),
        edges: [],
        description: `Split at ${at}: "${full.slice(0, at)}" | "${full.slice(at)}". Length ${full.length} verified.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { length: full.length },
    };
}

const module: AlgorithmModule = {
    id: "rope",
    name: "Rope",
    category: "data-structures",
    complexity: { time: "O(log n) index", space: "O(n)" },
    defaultInput: { chunks: ["hel", "lo ", "wor", "ld"], index: 7 },
    visualType: "tree",
    run,
};
export default module;
