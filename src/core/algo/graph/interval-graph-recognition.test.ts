import { describe, expect, it } from "vitest";
import module from "./interval-graph-recognition";

function verdict(graph: Record<string, string[]>): boolean {
    const frames = [...module.run({ graph })];
    return frames[frames.length - 1]!.meta.interval as boolean;
}

/** Independent reference: exhaustive PEO search plus asteroidal-triple test. */
function referenceIsInterval(labels: string[], edges: Array<[string, string]>): boolean {
    const adj = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [a, b] of edges) {
        if (a === b) continue;
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
    }
    const permutations = (arr: string[]): string[][] => {
        if (arr.length <= 1) return [arr];
        const out: string[][] = [];
        for (let i = 0; i < arr.length; i += 1) {
            for (const rest of permutations(arr.filter((_, j) => j !== i))) out.push([arr[i] as string, ...rest]);
        }
        return out;
    };
    const perfect = permutations(labels).some((order) => {
        const rank = new Map(order.map((v, i) => [v, i]));
        return order.every((v, i) => {
            const later = [...adj.get(v)!].filter((u) => (rank.get(u) as number) > i);
            return later.every((a) => later.every((b) => a === b || adj.get(a)!.has(b)));
        });
    });
    if (!perfect) return false;

    const reachable = (s: string, t: string, blocked: Set<string>): boolean => {
        if (blocked.has(s) || blocked.has(t)) return false;
        const seen = new Set([s]);
        const q = [s];
        while (q.length) {
            const v = q.shift() as string;
            for (const u of adj.get(v)!) {
                if (u === t) return true;
                if (!seen.has(u) && !blocked.has(u)) {
                    seen.add(u);
                    q.push(u);
                }
            }
        }
        return false;
    };
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            const a = labels[i] as string;
            const b = labels[j] as string;
            if (adj.get(a)!.has(b)) continue;
            for (let k = j + 1; k < labels.length; k += 1) {
                const c = labels[k] as string;
                if (adj.get(a)!.has(c) || adj.get(b)!.has(c)) continue;
                const bc = new Set([c, ...adj.get(c)!]);
                const bb = new Set([b, ...adj.get(b)!]);
                const ba = new Set([a, ...adj.get(a)!]);
                if (reachable(a, b, bc) && reachable(a, c, bb) && reachable(b, c, ba)) return false;
            }
        }
    }
    return true;
}

function graphFrom(labels: string[], present: Set<string>): Record<string, string[]> {
    const g: Record<string, string[]> = Object.fromEntries(labels.map((v) => [v, []]));
    for (const key of present) {
        const [a, b] = key.split("|") as [string, string];
        g[a]!.push(b);
        g[b]!.push(a);
    }
    return g;
}

describe("interval-graph-recognition", () => {
    it("agrees with an independent characterization on all graphs of four vertices (brute force)", () => {
        const labels = ["A", "B", "C", "D"];
        const pairs: string[] = [];
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) pairs.push(`${labels[i]}|${labels[j]}`);
        }
        for (let mask = 0; mask < 1 << pairs.length; mask += 1) {
            const present = new Set(pairs.filter((_, i) => (mask >> i) & 1));
            const graph = graphFrom(labels, present);
            const expected = referenceIsInterval(labels, [...present].map((k) => k.split("|") as [string, string]));
            expect(verdict(graph), JSON.stringify(graph)).toBe(expected);
        }
    });

    it("rejects the asteroidal claw-with-subdivided-arms example", () => {
        const graph: Record<string, string[]> = {
            X: ["a1", "a2", "a3"],
            a1: ["X", "b1"],
            a2: ["X", "b2"],
            a3: ["X", "b3"],
            b1: ["a1"],
            b2: ["a2"],
            b3: ["a3"],
        };
        expect(verdict(graph)).toBe(false);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThanOrEqual(3);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("graph");
            expect(Object.keys(frame.meta).length).toBeGreaterThan(0);
        });
        expect(frames[frames.length - 1]!.meta.interval).toBe(true);
    });
});
