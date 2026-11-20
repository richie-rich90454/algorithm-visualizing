/**
 * adaptive-a-star.test.ts - Dijkstra cross-check, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./adaptive-a-star";
import type { VisualFrame } from "@/types";

type WAdj = Record<string, Array<[string, number]>>;

function nodesOf(adj: WAdj): string[] {
    const set = new Set<string>(Object.keys(adj));
    for (const pairs of Object.values(adj)) for (const [v] of pairs) set.add(v);
    return [...set];
}

/** Independent Dijkstra on the directed weighted graph. */
function dijkstra(adj: WAdj, start: string, goal: string): number {
    const labels = nodesOf(adj);
    const dist: Record<string, number> = {};
    for (const v of labels) dist[v] = Infinity;
    if (!labels.includes(start)) return Infinity;
    dist[start] = 0;
    const seen = new Set<string>();
    while (true) {
        let u: string | null = null;
        let best = Infinity;
        for (const v of labels) {
            if (!seen.has(v) && (dist[v] ?? Infinity) < best) { best = dist[v] as number; u = v; }
        }
        if (u === null) break;
        seen.add(u);
        if (u === goal) break;
        for (const [v, cost] of adj[u] ?? []) {
            const next = (dist[u] as number) + cost;
            if (next < (dist[v] ?? Infinity)) dist[v] = next;
        }
    }
    return dist[goal] ?? Infinity;
}

type RecordShape = { start: string; pathCost: number; updated: Record<string, number>; g: Record<string, number> };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const ids = new Set<string>();
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const e of frame.entities) { expect(e.type).toBe("node"); ids.add(e.id); }
    });
    for (const frame of frames) {
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    }
}

describe("Adaptive A*", () => {
    it("returns optimal paths for every search in the sequence", () => {
        const input = mod.defaultInput as { graph: WAdj; searches: string[]; goal: string };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const records = frames[frames.length - 1]?.meta["searches"] as RecordShape[];
        expect(records.length).toBe(input.searches.length);
        records.forEach((record) => {
            expect(record.pathCost).toBeCloseTo(dijkstra(input.graph, record.start, input.goal), 9);
        });
    });

    it("updates expanded nodes to an admissible g(goal) minus g(v)", () => {
        const input = mod.defaultInput as { graph: WAdj; searches: string[]; goal: string };
        const frames = [...mod.run(mod.defaultInput)];
        const records = frames[frames.length - 1]?.meta["searches"] as RecordShape[];
        for (const record of records) {
            for (const [node, value] of Object.entries(record.updated)) {
                expect(value).toBeCloseTo(record.pathCost - (record.g[node] as number), 9);
                expect(value).toBeLessThanOrEqual(dijkstra(input.graph, node, input.goal) + 1e-9);
            }
        }
    });

    it("keeps later searches at least as cheap in expansions as the first", () => {
        const input = mod.defaultInput as { searches: string[] };
        const frames = [...mod.run(mod.defaultInput)];
        const updateFrames = frames.filter((f) => String(f.description).includes("Update h for"));
        expect(updateFrames.length).toBe(input.searches.length);
        const expanded = updateFrames.map((f) => Number(f.meta["expanded"]));
        expect(expanded[expanded.length - 1]).toBeLessThanOrEqual(expanded[0] as number);
    });

    it("handles an unreachable goal without throwing", () => {
        const input = { graph: { A: [["B", 1]], B: [], C: [["D", 1]], D: [] }, start: "A", goal: "D", searches: ["A"] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const records = frames[frames.length - 1]?.meta["searches"] as RecordShape[];
        expect(records[0]?.pathCost).toBe(Infinity);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
