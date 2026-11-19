/**
 * planar-graph-dual.test.ts - Euler formula, face coverage, and an independent
 * successor-turn face trace, plus frame shape and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./planar-graph-dual";
import type { VisualFrame } from "@/types";

type Rotation = Record<string, string[]>;

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

/** Independent trace using the successor turn instead of the predecessor turn. */
function traceFacesSuccessor(rotation: Rotation): number[] {
    const labels = Object.keys(rotation).sort();
    const darts = labels.flatMap((u) => (rotation[u] ?? []).filter((v) => labels.includes(v)).map((v) => `${u}|${v}`));
    const visited = new Set<string>();
    const sizes: number[] = [];
    const nextKey = (key: string): string => {
        const [u, v] = key.split("|") as [string, string];
        const ring = rotation[v] ?? [];
        const idx = ring.indexOf(u);
        const successor = ring[(idx + 1) % ring.length] as string;
        return `${v}|${successor}`;
    };
    for (const start of darts) {
        if (visited.has(start)) continue;
        let key = start;
        let count = 0;
        while (!visited.has(key)) {
            visited.add(key);
            count += 1;
            key = nextKey(key);
        }
        sizes.push(count);
    }
    return sizes.sort((a, b) => a - b);
}

describe("Planar Graph Dual", () => {
    it("satisfies Euler's formula and covers every directed edge once", () => {
        const embeddings: Rotation[] = [
            (mod.defaultInput as { rotation: Rotation }).rotation,
            { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["A", "C"] },
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        ];
        for (const rotation of embeddings) {
            const frames = [...mod.run({ rotation })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const v = Object.keys(rotation).length;
            const e = Number(meta?.["primalEdges"]);
            const f = Number(meta?.["faces"]);
            expect(f).toBe(e - v + 2);
            expect(Number(meta?.["dualEdges"])).toBe(e);
            const sizes = (meta?.["faceSizes"] as number[]) ?? [];
            expect(sizes.reduce((sum, n) => sum + n, 0)).toBe(2 * e);
            const independent = traceFacesSuccessor(rotation);
            expect([...sizes].sort((a, b) => a - b)).toEqual(independent);
        }
    });

    it("makes a dual loop for a bridge", () => {
        const rotation: Rotation = {
            A: ["B", "C", "D"],
            B: ["A"],
            C: ["A"],
            D: ["A"],
        };
        const frames = [...mod.run({ rotation })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        // A tree has one face, so every one of its three edges becomes a dual loop.
        expect(meta?.["faces"]).toBe(1);
        expect(meta?.["loops"]).toBe(3);
    });

    it("terminates on an empty embedding", () => {
        const frames = [...mod.run({ rotation: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["faces"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
