/** node2vec.test.ts - Walk validity, bias sensitivity, embeddings, frames. */

import { describe, expect, it } from "vitest";
import mod from "./node2vec";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;
const input = mod.defaultInput as { graph: Graph; dimensions: number; seed: number };
const graph = input.graph;

const neighbors = new Map<string, Set<string>>(Object.keys(graph).map((v) => [v, new Set<string>()]));
for (const [u, vs] of Object.entries(graph)) {
    for (const v of vs) {
        neighbors.get(u)?.add(v);
        neighbors.get(v)?.add(u);
    }
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function collectFrames(config: Partial<{ p: number; q: number; seed: number }>): VisualFrame[] {
    return [...mod.run({ ...input, ...config })];
}

describe("Node2vec", () => {
    it("only walks along real edges and emits deterministic finite embeddings", () => {
        const frames = collectFrames({});
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        const walks = frames
            .map((f) => String(f.meta["walk"] ?? ""))
            .filter((walk) => walk.length > 0 && walk.includes("-"));
        expect(walks.length).toBeGreaterThan(0);
        for (const walk of walks) {
            const vertices = walk.split("-");
            for (let i = 1; i < vertices.length; i += 1) {
                expect(neighbors.get(vertices[i - 1] as string)?.has(vertices[i] as string)).toBe(true);
            }
        }
        const embedding = last.meta["embedding"] as number[];
        expect(embedding).toHaveLength(Object.keys(graph).length * input.dimensions);
        expect(embedding.every((value) => Number.isFinite(value))).toBe(true);
        expect(Number(last.meta["walksGenerated"] ?? last.meta["walks"])).toBeGreaterThan(0);
    });

    it("changes walk statistics when the in-out parameter changes", () => {
        const local = collectFrames({ p: 1, q: 0.5, seed: 11 });
        const global = collectFrames({ p: 1, q: 4, seed: 11 });
        const a = local[local.length - 1] as VisualFrame;
        const b = global[global.length - 1] as VisualFrame;
        const stat = (frame: VisualFrame): string =>
            `${frame.meta["bfsSteps"]}/${frame.meta["dfsSteps"]}/${frame.meta["returnSteps"]}`;
        expect(stat(a)).not.toBe(stat(b));
        expect(Number(a.meta["dfsSteps"])).toBeGreaterThan(Number(b.meta["dfsSteps"]));
        expect(Number(b.meta["bfsSteps"])).toBeGreaterThanOrEqual(Number(a.meta["bfsSteps"]));
    });

    it("terminates cleanly and repeats a fixed seed exactly", () => {
        const generator = mod.run(input);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        const again = collectFrames({});
        expect(frames[frames.length - 1]?.meta["embedding"]).toEqual(again[again.length - 1]?.meta["embedding"]);
    });
});
