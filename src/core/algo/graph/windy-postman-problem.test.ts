/** Correctness, frame shape, and termination checks for the windy postman. */
import { describe, expect, it } from "vitest";
import mod from "./windy-postman-problem";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

/** Exhaustive minimum over feasible usage patterns with Euler checks. */
function brute(edges: Array<[string, string, number, number]>): number {
    const vertices = [...new Set(edges.flatMap(([a, b]) => [a, b]))];
    const m = edges.length;
    let best = Infinity;
    for (let code = 0; code < 4 ** m; code += 1) {
        let digits = code;
        const arcs: Array<[string, string]> = [];
        let cost = 0;
        let valid = true;
        for (let e = 0; e < m; e += 1) {
            const digit = digits % 4;
            digits = Math.floor(digits / 4);
            if (digit === 0) { valid = false; break; }
            const [a, b, forward, backward] = edges[e] as [string, string, number, number];
            if (digit === 1 || digit === 3) { arcs.push([a, b]); cost += forward; }
            if (digit === 2 || digit === 3) { arcs.push([b, a]); cost += backward; }
        }
        if (!valid) continue;
        const out = new Map<string, number>(vertices.map((v) => [v, 0]));
        const inc = new Map<string, number>(vertices.map((v) => [v, 0]));
        const adj = new Map<string, string[]>(vertices.map((v) => [v, []]));
        for (const [u, v] of arcs) {
            out.set(u, (out.get(u) ?? 0) + 1);
            inc.set(v, (inc.get(v) ?? 0) + 1);
            adj.get(u)?.push(v);
        }
        if (vertices.some((v) => (out.get(v) ?? 0) !== (inc.get(v) ?? 0))) continue;
        const active = vertices.filter((v) => (out.get(v) ?? 0) > 0);
        if (active.length === 0) continue;
        const reachable = (start: string): Set<string> => {
            const seen = new Set([start]);
            const queue = [start];
            for (let head = 0; head < queue.length; head += 1) {
                for (const v of adj.get(queue[head] as string) ?? []) {
                    if (!seen.has(v)) { seen.add(v); queue.push(v); }
                }
            }
            return seen;
        };
        const forwardReach = reachable(active[0] as string);
        if (!active.every((v) => forwardReach.has(v))) continue;
        best = Math.min(best, cost);
    }
    return best;
}

describe("Windy Postman Problem", () => {
    const cases: Array<{ edges: Array<[string, string, number, number]>; start: string }> = [
        { edges: [["A", "B", 3, 1]], start: "A" },
        { edges: [["A", "B", 3, 1], ["A", "C", 1, 4], ["B", "C", 2, 2]], start: "A" },
        { edges: [["A", "B", 1, 5], ["C", "D", 2, 3]], start: "C" },
        { edges: [["A", "B", 2, 7], ["B", "C", 1, 6], ["C", "A", 4, 1]], start: "B" },
    ];

    for (const input of cases) {
        it(`matches exhaustive enumeration for ${input.edges.length} edges`, () => {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = brute(input.edges);
            expect(final?.["optimalCost"]).toBe(Number.isFinite(expected) ? expected : -1);
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
