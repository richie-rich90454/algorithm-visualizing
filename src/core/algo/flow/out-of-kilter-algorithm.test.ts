/** out-of-kilter-algorithm.test.ts - Bellman-Ford min-cost-flow cross-check. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./out-of-kilter-algorithm";

type Arc = [string, string, number, number];
type Input = { vertices: string[]; arcs: Arc[]; source: string; sink: string; maxFlow: number };

/** Independent reference: successive shortest augmenting paths, Bellman-Ford, no potentials. */
function reference(input: Input): { sent: number; cost: number } {
    const names = Array.from(new Set([
        ...input.vertices,
        ...input.arcs.flatMap((a) => [a[0], a[1]]),
    ]));
    const idx = new Map(names.map((n, i) => [n, i]));
    const cap: number[][] = names.map(() => names.map(() => 0));
    const cost: number[][] = names.map(() => names.map(() => 0));
    for (const [u, v, c, w] of input.arcs) {
        const iu = idx.get(u)!;
        const iv = idx.get(v)!;
        cap[iu]![iv] = (cap[iu]![iv] ?? 0) + c;
        cost[iu]![iv] = w;
    }
    const s = idx.get(input.source)!;
    const t = idx.get(input.sink)!;
    let sent = 0;
    let total = 0;
    while (sent < input.maxFlow) {
        const dist = new Array<number>(names.length).fill(Infinity);
        const prev = new Array<number>(names.length).fill(-1);
        dist[s] = 0;
        for (let k = 0; k < names.length - 1; k += 1) {
            for (let i = 0; i < names.length; i += 1) {
                if (!Number.isFinite(dist[i]!)) continue;
                for (let j = 0; j < names.length; j += 1) {
                    if (cap[i]![j]! > 0 && dist[i]! + cost[i]![j]! < dist[j]!) {
                        dist[j] = dist[i]! + cost[i]![j]!;
                        prev[j] = i;
                    }
                }
            }
        }
        if (!Number.isFinite(dist[t]!)) break;
        let delta = input.maxFlow - sent;
        let cur = t;
        while (cur !== s) {
            const p = prev[cur]!;
            delta = Math.min(delta, cap[p]![cur]!);
            cur = p;
        }
        cur = t;
        while (cur !== s) {
            const p = prev[cur]!;
            cap[p]![cur] = cap[p]![cur]! - delta;
            cap[cur]![p] = (cap[cur]![p] ?? 0) + delta;
            cur = p;
        }
        sent += delta;
        total += delta * dist[t]!;
    }
    return { sent, cost: total };
}

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThanOrEqual(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.layout).toBe("graph");
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.entities.length).toBeGreaterThan(0);
        f.edges.forEach((ed) => {
            expect(f.entities.some((e) => e.id === ed.sourceId)).toBe(true);
            expect(f.entities.some((e) => e.id === ed.targetId)).toBe(true);
        });
        expect(f.meta).toBeDefined();
    });
}

describe("Out-of-Kilter Algorithm", () => {
    it("matches an independent min-cost max-flow reference", () => {
        const input = mod.defaultInput as Input;
        const fs = frames(input);
        shapes(fs);
        const expected = reference(input);
        const last = fs[fs.length - 1]?.meta;
        expect(last?.["sent"]).toBe(expected.sent);
        expect(last?.["cost"]).toBe(expected.cost);
        expect(last?.["converged"]).toBe(true);
    });

    it("matches the reference on random small networks", () => {
        let seed = 987654;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const names = ["s", "a", "b", "c", "t"];
            const arcs: Arc[] = [];
            const pairs: Array<[string, string]> = [
                ["s", "a"], ["s", "b"], ["a", "b"], ["a", "c"], ["b", "c"],
                ["a", "t"], ["b", "t"], ["c", "t"],
            ];
            for (const [u, v] of pairs) {
                if (rand() < 0.8) arcs.push([u, v, 1 + Math.floor(rand() * 3), Math.floor(rand() * 8)]);
            }
            const input: Input = { vertices: names, arcs, source: "s", sink: "t", maxFlow: 2 };
            const fs = frames(input);
            shapes(fs);
            const expected = reference(input);
            const last = fs[fs.length - 1]?.meta;
            expect(last?.["sent"]).toBe(expected.sent);
            expect(last?.["cost"]).toBe(expected.cost);
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
