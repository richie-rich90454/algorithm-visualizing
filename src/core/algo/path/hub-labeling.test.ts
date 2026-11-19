/** Correctness, frame shape, and termination checks for hub labeling. */
import { describe, expect, it } from "vitest";
import mod from "./hub-labeling";
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

/** Independent all-pairs BFS distances. */
function bfsAll(vertices: string[], edges: Array<[string, string]>): Map<string, number> {
    const adjacency = new Map<string, string[]>();
    for (const v of vertices) adjacency.set(v, []);
    for (const [a, b] of edges) {
        adjacency.get(a)?.push(b);
        adjacency.get(b)?.push(a);
    }
    const result = new Map<string, number>();
    for (const source of vertices) {
        const dist = new Map<string, number>([[source, 0]]);
        const queue = [source];
        for (let head = 0; head < queue.length; head += 1) {
            const u = queue[head] as string;
            for (const v of adjacency.get(u) ?? []) {
                if (dist.has(v)) continue;
                dist.set(v, (dist.get(u) as number) + 1);
                queue.push(v);
            }
        }
        for (const target of vertices) {
            if (source !== target) result.set(`${source}->${target}`, dist.get(target) ?? -1);
        }
    }
    return result;
}

describe("Hub Labeling", () => {
    const cases: Array<{ edges: Array<[string, string]>; hubCount: number }> = [
        { edges: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"]], hubCount: 5 },
        { edges: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"], ["D", "E"], ["E", "F"], ["E", "G"], ["F", "G"], ["G", "H"]], hubCount: 8 },
        { edges: [["A", "B"], ["B", "C"], ["C", "A"], ["C", "D"], ["D", "E"], ["E", "F"], ["F", "D"]], hubCount: 7 },
        { edges: [["A", "B"], ["C", "D"], ["D", "E"]], hubCount: 5 },
    ];

    for (const input of cases) {
        it(`answers every query exactly for ${JSON.stringify(input.edges.length)} edges`, () => {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["uncovered"]).toBe(0);
            const sample = final?.["sampleQueries"] as string[];
            const reference = bfsAll([...new Set(input.edges.flatMap(([a, b]) => [a, b]))].sort(), input.edges);
            for (const entry of sample) {
                const [pair, value] = entry.split("=");
                expect(Number(value)).toBe(reference.get(pair as string));
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
