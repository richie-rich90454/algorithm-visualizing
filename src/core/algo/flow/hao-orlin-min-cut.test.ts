import { describe, expect, it } from "vitest";
import mod from "./hao-orlin-min-cut";
import type { VisualFrame } from "@/types";

type Input = { vertices: string[]; edges: Array<[string, string, number]> };

function bruteForceMinCut(input: Input): number {
    const n = input.vertices.length;
    let best = Infinity;
    for (let mask = 1; mask < (1 << n) - 1; mask += 1) {
        let value = 0;
        for (const [u, v, w] of input.edges) {
            const a = input.vertices.indexOf(u);
            const b = input.vertices.indexOf(v);
            if (((mask >> a) & 1) !== ((mask >> b) & 1)) {
                value += w;
            }
        }
        best = Math.min(best, value);
    }
    return best;
}

function checkFrames(frames: VisualFrame[], nodes: number, edges: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.edges.length).toBe(edges);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Hao-Orlin Minimum Cut", () => {
    it("finds the global minimum cut on the default graph", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.vertices.length, input.edges.length);
        expect(frames[frames.length - 1]?.meta["bestCut"]).toBe(bruteForceMinCut(input));
    });

    it("matches brute force on random graphs", () => {
        const vertices = ["a", "b", "c", "d", "e", "f"];
        for (let trial = 0; trial < 25; trial += 1) {
            const edges: Array<[string, string, number]> = [];
            for (let i = 0; i < vertices.length; i += 1) {
                for (let j = i + 1; j < vertices.length; j += 1) {
                    if (Math.random() < 0.55) {
                        edges.push([vertices[i] ?? "a", vertices[j] ?? "f", 1 + Math.floor(Math.random() * 9)]);
                    }
                }
            }
            if (edges.length === 0) {
                continue;
            }
            const input: Input = { vertices, edges };
            const frames = [...mod.run(input)];
            expect(frames[frames.length - 1]?.meta["bestCut"]).toBe(bruteForceMinCut(input));
        }
    });

    it("handles a trivial graph and terminates cleanly", () => {
        const frames = [...mod.run({ vertices: ["a"], edges: [] })];
        expect(frames.length).toBeGreaterThan(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
