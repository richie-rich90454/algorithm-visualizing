/**
 * infomap-community.test.ts - Correctness and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import infomap from "./infomap-community";

type Graph = Record<string, string[]>;

function normalize(g: Graph): Graph {
    const out: Graph = {};
    for (const v of Object.keys(g)) {
        out[v] = [];
    }
    for (const [u, ns] of Object.entries(g)) {
        for (const v of ns) {
            out[u] ??= [];
            out[v] ??= [];
            if (!out[u].includes(v)) {
                out[u].push(v);
            }
            if (!out[v].includes(u)) {
                out[v].push(u);
            }
        }
    }
    return out;
}

/** Independent map-equation implementation used as an oracle. */
function independentMapEquation(g: Graph, communities: number[]): number {
    const ng = normalize(g);
    const verts = Object.keys(ng).sort();
    const n = verts.length;
    const deg = verts.map((v) => (ng[v] ?? []).length);
    const tele = 0.15;
    const P: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const walk = deg[i]! > 0 && (ng[verts[i]!] ?? []).includes(verts[j]!)
                ? 1 / deg[i]!
                : deg[i] === 0
                  ? 1 / n
                  : 0;
            P[i]![j] = (1 - tele) * walk + tele / n;
        }
    }
    let pi = Array<number>(n).fill(1 / n);
    for (let it = 0; it < 300; it += 1) {
        const next = Array<number>(n).fill(0);
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                next[j] = next[j]! + pi[i]! * P[i]![j]!;
            }
        }
        pi = next;
    }
    const mass = new Map<number, number>();
    const exit = new Map<number, number>();
    for (let i = 0; i < n; i += 1) {
        mass.set(communities[i]!, (mass.get(communities[i]!) ?? 0) + pi[i]!);
    }
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (communities[i] !== communities[j]) {
                exit.set(communities[i]!, (exit.get(communities[i]!) ?? 0) + pi[i]! * P[i]![j]!);
            }
        }
    }
    let totalExit = 0;
    for (const v of exit.values()) {
        totalExit += v;
    }
    let L = 0;
    for (const [m, flow] of exit) {
        if (totalExit > 0 && flow > 0) {
            const f = flow / totalExit;
            L += -flow * Math.log2(f);
        }
        const mm = mass.get(m) ?? 0;
        if (mm > 0) {
            for (let i = 0; i < n; i += 1) {
                if (communities[i] === m) {
                    const p = pi[i]! / mm;
                    if (p > 0) {
                        L += mm * (-p * Math.log2(p));
                    }
                }
            }
        }
    }
    return L;
}

describe("InfomapCommunity", () => {
    const twoTriangles: Graph = {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B"],
        D: ["A", "E", "F"],
        E: ["D", "F"],
        F: ["D", "E"],
    };

    it("assigns every vertex to a valid contiguous community", () => {
        const frames = [...infomap.run({ graph: twoTriangles })];
        const final = frames.at(-1);
        const communities = final?.meta.communities as number[];
        expect(communities.length).toBe(6);
        expect([...communities].sort()).toEqual([0, 0, 0, 1, 1, 1].sort());
        expect(final?.meta.modules).toBe(2);
    });

    it("separates two cliques joined by a single bridge", () => {
        const frames = [...infomap.run({ graph: twoTriangles })];
        const communities = frames.at(-1)?.meta.communities as number[];
        const verts = Object.keys(normalize(twoTriangles)).sort();
        const group = (v: string) => communities[verts.indexOf(v)];
        expect(group("A")).toBe(group("B"));
        expect(group("A")).toBe(group("C"));
        expect(group("D")).toBe(group("E"));
        expect(group("D")).toBe(group("F"));
        expect(group("A")).not.toBe(group("D"));
    });

    it("reports a map equation consistent with an independent computation and never increases it", () => {
        const frames = [...infomap.run({ graph: twoTriangles })];
        const final = frames.at(-1);
        const communities = final?.meta.communities as number[];
        expect(final?.meta.mapEquation).toBeCloseTo(independentMapEquation(twoTriangles, communities), 6);
        const singletons = [0, 1, 2, 3, 4, 5];
        expect(final?.meta.mapEquation as number).toBeLessThanOrEqual(
            independentMapEquation(twoTriangles, singletons) + 1e-9,
        );
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...infomap.run(infomap.defaultInput)];
        expect(frames.length).toBeGreaterThanOrEqual(2);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("graph");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(infomap.pseudocode?.length ?? 0);
            for (const edge of frame.edges) {
                expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
                expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
            }
        }
    });
});
