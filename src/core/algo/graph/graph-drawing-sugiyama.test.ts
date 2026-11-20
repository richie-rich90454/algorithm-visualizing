/**
 * graph-drawing-sugiyama.test.ts - Layering and crossing-count properties
 * recomputed independently from the final frame, plus frame shape, cycle
 * handling, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./graph-drawing-sugiyama";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Sugiyama Layered Graph Drawing", () => {
    it("places arcs on adjacent layers and reports the true crossing count", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { graph: Adj }).graph,
            { A: ["C", "D"], B: ["C", "D"], C: ["E"], D: ["E"], E: [] },
            { A: ["D"], B: ["E"], C: ["D", "E"], D: [], E: [] },
        ];
        for (const graph of graphs) {
            const frames = [...mod.run({ graph, sweeps: 4 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const layers = new Map<string, number>();
            for (const entry of final?.meta["layersOf"] as string[]) {
                const [v, l] = entry.split(":");
                layers.set(v as string, Number(l));
            }
            const order = new Map<number, string[]>();
            for (const entry of final?.meta["order"] as string[]) {
                const [l, list] = entry.split(":");
                order.set(Number(l), (list ?? "").split(",").filter(Boolean));
            }
            for (const entry of final?.meta["arcs"] as string[]) {
                const clean = entry.replace("*", "");
                const [from, to] = clean.split(">");
                expect(layers.get(to as string)).toBeGreaterThan(layers.get(from as string) as number);
            }
            const positions = new Map<string, number>();
            for (const [layer, vertices] of order) {
                vertices.forEach((v, i) => positions.set(v, i));
            }
            let crossings = 0;
            const maxLayer = Number(final?.meta["layers"]) - 1;
            for (let l = 0; l < maxLayer; l += 1) {
                const pairs: Array<[number, number]> = [];
                for (const edge of final?.edges ?? []) {
                    const u = edge.sourceId.replace(/^node-/, "");
                    const v = edge.targetId.replace(/^node-/, "");
                    if (layers.get(u) !== l) continue;
                    expect(layers.get(v)).toBe(l + 1);
                    const pu = positions.get(u);
                    const pv = positions.get(v);
                    if (pu !== undefined && pv !== undefined) pairs.push([pu, pv]);
                }
                for (let i = 0; i < pairs.length; i += 1) {
                    for (let j = i + 1; j < pairs.length; j += 1) {
                        const a = pairs[i] as [number, number];
                        const b = pairs[j] as [number, number];
                        if ((a[0] - b[0]) * (a[1] - b[1]) < 0) crossings += 1;
                    }
                }
            }
            expect(crossings).toBe(Number(final?.meta["crossings"]));
        }
    });

    it("breaks a directed cycle before layering", () => {
        const frames = [...mod.run({ graph: { A: ["B"], B: ["C"], C: ["A"] }, sweeps: 2 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const arcs = final?.meta["arcs"] as string[];
        expect(arcs.some((a) => a.endsWith("*"))).toBe(true);
        expect(Number(final?.meta["crossings"])).toBeGreaterThanOrEqual(0);
    });

    it("terminates on an empty graph and on the default input", () => {
        const frames = [...mod.run({ graph: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["layers"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
