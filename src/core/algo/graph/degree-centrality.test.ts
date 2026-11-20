import { describe, expect, it } from "vitest";
import mod from "./degree-centrality";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent degree computation over a deduplicated undirected edge list. */
function bruteDegrees(edges: Array<[string, string]>): Map<string, number> {
    const neighbors = new Map<string, Set<string>>();
    for (const [a, b] of edges) {
        if (!neighbors.has(a)) neighbors.set(a, new Set());
        if (!neighbors.has(b)) neighbors.set(b, new Set());
        neighbors.get(a)!.add(b);
        neighbors.get(b)!.add(a);
    }
    return new Map([...neighbors].map(([v, set]) => [v, set.size]));
}

describe("Degree Centrality", () => {
    it("matches a brute-force degree count on the default graph", () => {
        const input = mod.defaultInput as { edges: Array<[string, string]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const labels = meta["labels"] as string[];
        const degree = meta["degree"] as number[];
        const centrality = meta["centrality"] as number[];
        const expected = bruteDegrees(input.edges);
        labels.forEach((label, index) => {
            expect(degree[index]).toBe(expected.get(label));
            expect(centrality[index]).toBeCloseTo((expected.get(label) ?? 0) / (labels.length - 1), 10);
            expect(centrality[index]!).toBeGreaterThanOrEqual(0);
            expect(centrality[index]!).toBeLessThanOrEqual(1);
        });
    });

    it("ranks the center of a star at one and leaves at 1/(n-1)", () => {
        const edges: Array<[string, string]> = [["A", "C"], ["B", "C"], ["D", "C"], ["E", "C"]];
        const frames = [...mod.run({ edges })];
        const meta = frames[frames.length - 1]!.meta;
        const labels = meta["labels"] as string[];
        const centrality = meta["centrality"] as number[];
        expect(centrality[labels.indexOf("C")]).toBeCloseTo(1, 10);
        for (const label of ["A", "B", "D", "E"]) {
            expect(centrality[labels.indexOf(label)]).toBeCloseTo(0.25, 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
