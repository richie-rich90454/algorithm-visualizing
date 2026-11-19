import { describe, expect, it } from "vitest";
import mod from "./karger-k-cut";
import type { VisualFrame } from "@/types";

type Input = { vertices: string[]; edges: Array<[string, string, number]>; k?: number; seed?: number; trials?: number };

function bruteForceKCut(input: Input, k: number): number {
    const n = input.vertices.length;
    const groups = new Array<number>(n).fill(0);
    let used = 1;
    let best = Infinity;
    const value = (): number => {
        let total = 0;
        for (const [u, v, w] of input.edges) {
            if (groups[input.vertices.indexOf(u)] !== groups[input.vertices.indexOf(v)]) {
                total += w;
            }
        }
        return total;
    };
    const search = (at: number): void => {
        if (at === n) {
            if (used === k) {
                best = Math.min(best, value());
            }
            return;
        }
        for (let g = 0; g < Math.min(k, used + 1); g += 1) {
            const introduced = g === used;
            if (introduced) {
                used += 1;
            }
            groups[at] = g;
            search(at + 1);
            if (introduced) {
                used -= 1;
            }
        }
    };
    search(0);
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

describe("Karger Minimum k-Cut", () => {
    it("finds the minimum k-cut on the default graph", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.vertices.length, input.edges.length);
        expect(frames[frames.length - 1]?.meta["bestCut"]).toBe(bruteForceKCut(input, 3));
    });

    it("matches brute force for k equals two and three", () => {
        const vertices = ["a", "b", "c", "d", "e"];
        for (let trial = 0; trial < 16; trial += 1) {
            const edges: Array<[string, string, number]> = [];
            for (let i = 0; i < vertices.length; i += 1) {
                for (let j = i + 1; j < vertices.length; j += 1) {
                    if (Math.random() < 0.6) {
                        edges.push([vertices[i] ?? "a", vertices[j] ?? "e", 1 + Math.floor(Math.random() * 7)]);
                    }
                }
            }
            const k = trial % 2 === 0 ? 2 : 3;
            const input: Input = { vertices, edges, k, seed: trial + 5, trials: 200 };
            const frames = [...mod.run(input)];
            expect(frames[frames.length - 1]?.meta["bestCut"]).toBe(bruteForceKCut(input, k));
        }
    });

    it("handles k equals one and terminates cleanly", () => {
        const frames = [...mod.run({ ...(mod.defaultInput as Input), k: 1 })];
        expect(frames[frames.length - 1]?.meta["bestCut"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
