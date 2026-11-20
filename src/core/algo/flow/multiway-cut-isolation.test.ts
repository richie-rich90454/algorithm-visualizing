/** Correctness, approximation bound, frame shape, and termination checks. */
import { describe, expect, it } from "vitest";
import mod from "./multiway-cut-isolation";
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

function weightOf(edges: Array<[string, string, number?]>, a: string, b: string): number {
    for (const [x, y, w] of edges) {
        if ((x === a && y === b) || (x === b && y === a)) return typeof w === "number" && w > 0 ? w : 1;
    }
    return 0;
}

/** Exhaustive optimum over all assignments of non-terminals to terminals. */
function optimal(edges: Array<[string, string, number?]>, terminals: string[]): number {
    const vertices = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const others = vertices.filter((v) => !terminals.includes(v));
    let best = Infinity;
    for (let code = 0; code < terminals.length ** others.length; code += 1) {
        const assign = new Map<string, string>();
        terminals.forEach((t, i) => assign.set(t, t));
        let rest = code;
        for (const v of others) {
            assign.set(v, terminals[rest % terminals.length] as string);
            rest = Math.floor(rest / terminals.length);
        }
        let cost = 0;
        for (const [a, b] of edges) {
            if (assign.get(a) !== assign.get(b)) cost += weightOf(edges, a, b);
        }
        best = Math.min(best, cost);
    }
    return best;
}

describe("Multiway Cut by Isolating Cuts", () => {
    const cases: Array<{ edges: Array<[string, string, number?]>; terminals: string[] }> = [
        { edges: [["A", "B", 1], ["B", "C", 1], ["C", "D", 1]], terminals: ["A", "B", "D"] },
        { edges: [["A", "B", 2], ["A", "C", 1], ["B", "C", 2], ["B", "D", 3], ["C", "D", 1], ["D", "E", 2]], terminals: ["A", "C", "E"] },
        { edges: [["A", "B", 3], ["B", "C", 2], ["C", "D", 4], ["A", "D", 1], ["B", "D", 2]], terminals: ["A", "C", "D"] },
    ];

    for (const input of cases) {
        it(`stays within 2x of the optimum for ${JSON.stringify(input.terminals)}`, () => {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["valid"]).toBe(true);
            const cut = (final?.["cutEdges"] as string).split(",").filter(Boolean);
            const cost = cut.reduce((s, e) => {
                const [a, b] = e.split("-");
                return s + weightOf(input.edges, a as string, b as string);
            }, 0);
            expect(cost).toBe(final?.["cost"]);
            expect(cost).toBeLessThanOrEqual(2 * optimal(input.edges, input.terminals));

            // Removed edges must disconnect every pair of terminals.
            const adjacency = new Map<string, string[]>();
            for (const v of [...new Set(input.edges.flatMap(([a, b]) => [a, b]))]) adjacency.set(v, []);
            const removed = new Set(cut.map((e) => e.split("-").sort().join("-")));
            for (const [a, b] of input.edges) {
                if (removed.has([a, b].sort().join("-"))) continue;
                adjacency.get(a)?.push(b);
                adjacency.get(b)?.push(a);
            }
            for (const terminal of input.terminals) {
                const seen = new Set([terminal]);
                const queue = [terminal];
                for (let head = 0; head < queue.length; head += 1) {
                    for (const v of adjacency.get(queue[head] as string) ?? []) {
                        if (!seen.has(v)) { seen.add(v); queue.push(v); }
                    }
                }
                for (const other of input.terminals) {
                    if (other !== terminal) expect(seen.has(other)).toBe(false);
                }
            }
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
