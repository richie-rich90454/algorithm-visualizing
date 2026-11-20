import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./graph-canonization";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.edges.forEach((edge) => {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        });
    });
}

function adjacency(adj: Record<string, string[]>): Map<string, Set<string>> {
    const labels = [...new Set([...Object.keys(adj), ...Object.values(adj).flat()])];
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (u === v || !sets.has(u) || !sets.has(v)) continue;
            sets.get(u)?.add(v);
            sets.get(v)?.add(u);
        }
    }
    return sets;
}

/** Independent exhaustive canonicalization of an undirected graph. */
function bruteCanonical(adj: Record<string, string[]>): string {
    const sets = adjacency(adj);
    const labels = [...sets.keys()].sort();
    const n = labels.length;
    let best = "1".repeat(n * n);
    const perm: number[] = [];
    const used = new Array<boolean>(n).fill(false);
    const visit = (depth: number): void => {
        if (depth === n) {
            let bits = "";
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    bits += sets.get(labels[perm[i] as number] as string)?.has(labels[perm[j] as number] as string) ? "1" : "0";
                }
            }
            if (bits < best) best = bits;
            return;
        }
        for (let i = 0; i < n; i += 1) {
            if (used[i]) continue;
            used[i] = true;
            perm.push(i);
            visit(depth + 1);
            perm.pop();
            used[i] = false;
        }
    };
    visit(0);
    return best;
}

const graphs: Array<Record<string, string[]>> = [
    { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] },
    { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
    { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] },
    { A: [] },
];

describe("Graph canonization", () => {
    it("matches an independent exhaustive canonical form", () => {
        for (const graph of graphs) {
            const fs = frames({ graph });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(String(last?.meta["canonical"])).toBe(bruteCanonical(graph));
            const ones = String(last?.meta["canonical"]).split("1").length - 1;
            let edges = 0;
            for (const neighbors of adjacency(graph).values()) edges += neighbors.size;
            expect(ones).toBe(edges / 2);
        }
    });

    it("gives the same canonical string after relabeling", () => {
        const graph = { A: ["B", "C"], B: ["A", "D"], C: ["A"], D: ["B"] };
        const rename: Record<string, string> = { A: "W", B: "X", C: "Y", D: "Z" };
        const relabeled: Record<string, string[]> = {};
        for (const [u, vs] of Object.entries(graph)) {
            relabeled[rename[u] as string] = vs.map((v) => rename[v] as string);
        }
        const a = frames({ graph });
        const b = frames({ graph: relabeled });
        shapes(a);
        shapes(b);
        expect(a[a.length - 1]?.meta["canonical"]).toBe(b[b.length - 1]?.meta["canonical"]);
    });
});
