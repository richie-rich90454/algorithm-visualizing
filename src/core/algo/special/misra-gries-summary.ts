/**
 * misra-gries-summary.ts – Misra–Gries heavy-hitter summary.
 * Two counters scan 8 items: hits increment, misses occupy an empty
 * slot or decrement every counter. Survivors with count > 0 are the
 * candidates (any item past n/3 occurrences is guaranteed present).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { stream?: string[]; k?: number } | null) ?? {};
    const stream =
        Array.isArray(cfg.stream) && cfg.stream.length > 0
            ? (cfg.stream as string[]).slice(0, 12)
            : ["a", "b", "a", "c", "a", "b", "a", "d"];
    const k = Math.max(1, Math.min(4, cfg.k ?? 2));
    const table = new Map<string, number>();
    let step = 0;
    const frame = (idx: number, desc: string): VisualFrame => {
        const entries = [...table.entries()];
        const entities: VisualEntity[] = entries.map(([key, v], i) => ({
            id: `mg-${i}`,
            type: "cell" as const,
            label: `${key}=${v}`,
            value: v,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        const cur = stream[idx];
        if (idx >= 0 && idx < stream.length && cur !== undefined) {
            entities.push({
                id: "cur",
                type: "cell" as const,
                label: `→${cur}`,
                value: cur,
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: idx },
            });
        }
        if (entities.length === 0) {
            entities.push({
                id: "mg-empty",
                type: "cell" as const,
                label: "∅",
                value: "∅",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: idx,
            layout: "grid",
            meta: { counters: entries.map(([key, v]) => `${key}=${v}`).join(","), index: idx },
        };
    };
    yield frame(
        -1,
        `Stream [${stream.join(",")}] with k=${k} counters; heavy = past ${stream.length}/${k + 1} occurrences.`,
    );
    step += 1;
    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] ?? "";
        if (table.has(item)) table.set(item, (table.get(item) ?? 0) + 1);
        else if (table.size < k) table.set(item, 1);
        else {
            for (const [key, v] of [...table.entries()]) {
                if (v <= 1) table.delete(key);
                else table.set(key, v - 1);
            }
        }
        yield frame(
            i,
            `Saw "${item}": counters {${[...table.entries()].map(([key, v]) => `${key}=${v}`).join(", ") || "empty"}}.`,
        );
        step += 1;
    }
    yield frame(
        stream.length,
        `Candidates {${[...table.keys()].join(", ")}} — "a" (×${stream.filter((s) => s === "a").length}) survives as the true heavy hitter.`,
    );
}

const module: AlgorithmModule = {
    id: "misra-gries-summary",
    name: "Misra–Gries Summary",
    category: "data-structures",
    complexity: { time: "O(n·k)", space: "O(k)" },
    defaultInput: { stream: ["a", "b", "a", "c", "a", "b", "a", "d"], k: 2 },
    visualType: "grid",
    run,
};

export default module;
