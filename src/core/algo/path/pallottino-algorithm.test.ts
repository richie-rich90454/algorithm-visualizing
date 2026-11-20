/** pallottino-algorithm.test.ts - Bellman-Ford cross-check and frame checks. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./pallottino-algorithm";

type Edge = [string, string, number];

/** Independent Bellman-Ford reference over |V|-1 passes. */
function bellmanFord(verts: string[], edges: Edge[], source: string): Map<string, number> {
    const d = new Map<string, number>(verts.map((v) => [v, Infinity]));
    d.set(source, 0);
    for (let i = 0; i < verts.length - 1; i += 1) {
        let changed = false;
        for (const [u, v, w] of edges) {
            const du = d.get(u) ?? Infinity;
            if (du + w < (d.get(v) ?? Infinity)) {
                d.set(v, du + w);
                changed = true;
            }
        }
        if (!changed) break;
    }
    return d;
}

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.layout).toBe("graph");
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.entities.every((e) => e.type === "node")).toBe(true);
        f.edges.forEach((ed) => {
            expect(f.entities.some((e) => e.id === ed.sourceId)).toBe(true);
            expect(f.entities.some((e) => e.id === ed.targetId)).toBe(true);
        });
        expect(f.meta).toBeDefined();
    });
}

describe("Pallottino Algorithm", () => {
    it("matches Bellman-Ford on the default graph with a negative edge", () => {
        const input = mod.defaultInput as { vertices: string[]; edges: Edge[]; source: string };
        const fs = frames(input);
        shapes(fs);
        const expected = bellmanFord(input.vertices, input.edges, input.source);
        const last = fs[fs.length - 1]?.entities ?? [];
        for (const e of last) {
            const name = String(e.metadata["label"]);
            const want = expected.get(name);
            expect(Number(e.metadata["dist"])).toBe(want === undefined || !Number.isFinite(want) ? -1 : want);
        }
    });

    it("matches Bellman-Ford on several random nonnegative graphs", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const n = 5;
            const verts = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const edges: Edge[] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    if (i !== j && rand() < 0.4) {
                        edges.push([verts[i]!, verts[j]!, Math.floor(rand() * 10)]);
                    }
                }
            }
            const fs = frames({ vertices: verts, edges, source: "A" });
            shapes(fs);
            const expected = bellmanFord(verts, edges, "A");
            const last = fs[fs.length - 1]?.entities ?? [];
            for (const e of last) {
                const name = String(e.metadata["label"]);
                const want = expected.get(name);
            expect(Number(e.metadata["dist"])).toBe(want === undefined || !Number.isFinite(want) ? -1 : want);
            }
        }
    });

    it("terminates cleanly", () => {
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
