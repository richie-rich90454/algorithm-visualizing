/** kamada-kawai-layout.test.ts - Stress minimization, finite geometry, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./kamada-kawai-layout";

function collect(input: unknown) {
    return [...mod.run(input)];
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("KamadaKawaiLayout", () => {
    it("yields well-formed point-layout frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, index) => {
            expect(f.stepNumber).toBe(index);
            expect(f.description.length).toBeGreaterThanOrEqual(10);
            expect(f.layout).toBe("point");
            expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(f.meta).toBeDefined();
            expect(f.entities.every((e) => e.type === "node")).toBe(true);
            f.entities.forEach((e) => {
                const v = e.value as number[];
                expect(Number.isFinite(v[0]!)).toBe(true);
                expect(Number.isFinite(v[1]!)).toBe(true);
            });
        });
    });

    it("reduces graph-distance stress over the run", () => {
        const frames = collect(mod.defaultInput);
        const initial = frames[0]!.meta.energy as number;
        const final = frames.at(-1)!.meta.energy as number;
        expect(initial).toBeGreaterThan(0);
        expect(final).toBeLessThan(initial);
        expect(final).toBeGreaterThanOrEqual(0);
    });

    it("keeps coordinates finite on random graphs and single vertices", () => {
        const rnd = seeded(5150);
        for (let t = 0; t < 25; t += 1) {
            const n = 1 + Math.floor(rnd() * 7);
            const vertices = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Record<string, string[]> = {};
            for (const v of vertices) graph[v] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (rnd() < 0.5) {
                        graph[vertices[i]!]!.push(vertices[j]!);
                        graph[vertices[j]!]!.push(vertices[i]!);
                    }
                }
            }
            const frames = collect({ graph });
            const last = frames.at(-1)!;
            expect(last.entities).toHaveLength(n);
            last.entities.forEach((e) => {
                const v = e.value as number[];
                expect(Number.isFinite(v[0]!)).toBe(true);
                expect(Number.isFinite(v[1]!)).toBe(true);
            });
            expect(Number.isFinite(last.meta.energy as number)).toBe(true);
        }
    });

    it("handles an empty graph", () => {
        const frames = collect({ graph: {} });
        expect(frames).toHaveLength(1);
        expect(frames[0]!.meta.energy).toBe(0);
    });
});
