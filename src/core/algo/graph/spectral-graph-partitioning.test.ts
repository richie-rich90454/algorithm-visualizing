/**
 * spectral-graph-partitioning.test.ts - Eigenvector residual and exact
 * second-Laplacian-eigenvalue check via Jacobi, cut accounting, determinism,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./spectral-graph-partitioning";
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
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function laplacian(adjacency: Adj): number[][] {
    const vertices = Object.keys(adjacency).sort();
    const n = vertices.length;
    const idx = new Map(vertices.map((v, i) => [v, i]));
    const edges: Array<[number, number]> = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const b of adjacency[a] ?? []) {
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push([idx.get(a) as number, idx.get(b) as number]);
        }
    }
    const deg = new Array<number>(n).fill(0);
    for (const [a, b] of edges) {
        deg[a]! += 1;
        deg[b]! += 1;
    }
    const L = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? deg[i]! : 0)),
    );
    for (const [a, b] of edges) {
        L[a]![b]! -= 1;
        L[b]![a]! -= 1;
    }
    return L;
}

function eigenvalues(matrix: number[][]): number[] {
    const n = matrix.length;
    const a = matrix.map((row) => [...row]);
    for (let sweep = 0; sweep < 100; sweep += 1) {
        let off = 0;
        for (let i = 0; i < n; i += 1)
            for (let j = i + 1; j < n; j += 1) off += Math.abs(a[i]![j]!);
        if (off < 1e-12) break;
        for (let p = 0; p < n; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                if (Math.abs(a[p]![q]!) < 1e-15) continue;
                const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                for (let k = 0; k < n; k += 1) {
                    const akp = a[k]![p]!;
                    const akq = a[k]![q]!;
                    a[k]![p] = c * akp - s * akq;
                    a[k]![q] = s * akp + c * akq;
                }
                for (let k = 0; k < n; k += 1) {
                    const apk = a[p]![k]!;
                    const aqk = a[q]![k]!;
                    a[p]![k] = c * apk - s * aqk;
                    a[q]![k] = s * apk + c * aqk;
                }
            }
        }
    }
    return a.map((row, i) => row[i]!).sort((x, y) => x - y);
}

describe("Spectral Graph Partitioning (Fiedler Bisection)", () => {
    it("converges to the second Laplacian eigenvalue on connected graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D"] },
            { A: ["B", "C", "D", "E"], B: ["A", "C"], C: ["A", "B", "D"], D: ["A", "C", "E"], E: ["A", "D"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency, maxIterations: 600 })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const ev = eigenvalues(laplacian(adjacency));
            expect(Number(meta?.["lambda"])).toBeCloseTo(ev[1] as number, 3);
            expect(Number(meta?.["residual"])).toBeLessThan(1e-3);
        }
    });

    it("reports a cut consistent with the two sides", () => {
        const input = mod.defaultInput as { adjacency: Adj };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const a = new Set(String(meta?.["sideA"] ?? "").split(",").filter(Boolean));
        const b = new Set(String(meta?.["sideB"] ?? "").split(",").filter(Boolean));
        expect(a.size + b.size).toBe(Object.keys(input.adjacency).length);
        for (const v of a) expect(b.has(v)).toBe(false);
        let cut = 0;
        const seen = new Set<string>();
        for (const [u, pairs] of Object.entries(input.adjacency)) {
            for (const v of pairs) {
                const key = [u, v].sort().join("|");
                if (seen.has(key) || !input.adjacency[v]) continue;
                seen.add(key);
                if (a.has(u) !== a.has(v)) cut += 1;
            }
        }
        expect(cut).toBe(Number(meta?.["cutSize"]));
    });

    it("is deterministic and terminates on an empty graph", () => {
        const input = mod.defaultInput;
        expect([...mod.run(input)].at(-1)?.meta["cutSize"]).toBe([...mod.run(input)].at(-1)?.meta["cutSize"]);
        const frames = [...mod.run({ adjacency: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["cutSize"]).toBe(0);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
