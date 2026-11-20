/** maxcliquedyn.test.ts - Exact maximum clique comparison and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./maxcliquedyn";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;

function bruteForce(graph: Graph): string[] {
    const vertices = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const adjacency = new Map<string, Set<string>>(vertices.map((v) => [v, new Set<string>()]));
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const v of neighbors) {
            adjacency.get(u)?.add(v);
            adjacency.get(v)?.add(u);
        }
    }
    let best: string[] = [];
    for (let mask = 0; mask < 1 << vertices.length; mask += 1) {
        const subset: string[] = [];
        for (let i = 0; i < vertices.length; i += 1) {
            if ((mask & (1 << i)) !== 0) {
                subset.push(vertices[i] as string);
            }
        }
        const clique = subset.every((a) => subset.every((b) => a === b || adjacency.get(a)?.has(b)));
        if (clique && subset.length > best.length) {
            best = subset;
        }
    }
    return best.sort();
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(Array.isArray(frame.entities)).toBe(true);
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

describe("MaxCliqueDyn", () => {
    it("finds a maximum clique matching exhaustive subset search", () => {
        const cases: Graph[] = [
            {},
            { A: [] },
            { A: ["B"], B: ["A"] },
            {
                A: ["B", "C", "D"],
                B: ["A", "C", "E"],
                C: ["A", "B", "D", "E"],
                D: ["A", "C"],
                E: ["B", "C"],
                F: ["G"],
                G: ["F"],
            },
            {
                A: ["B", "C", "D", "E"],
                B: ["A", "C", "D"],
                C: ["A", "B", "D"],
                D: ["A", "B", "C"],
                E: ["A"],
                F: ["E"],
            },
        ];
        for (const graph of cases) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            const lastSize = Number(last.meta["bestSize"]);
            expect(lastSize).toBe(bruteForce(graph).length);
            const clique = last.meta["bestClique"] as string;
            expect(clique ? clique.split(",") : []).toHaveLength(lastSize);
        }
    });

    it("terminates cleanly and is deterministic", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
        const again = [...mod.run(mod.defaultInput)];
        expect(frames[frames.length - 1]?.meta["bestClique"]).toEqual(again[again.length - 1]?.meta["bestClique"]);
    });
});
