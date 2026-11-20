/**
 * kuhn-matching.test.ts - Brute-force maximum matching and validity checks.
 */

import { describe, expect, it } from "vitest";
import mod, { kuhnMatching } from "./kuhn-matching";
import type { VisualFrame } from "@/types";

/** Exhaustive reference: try every subset of edges with disjoint endpoints. */
function bruteForceMaximum(edges: Array<[string, string]>): number {
    let best = 0;
    const walk = (index: number, usedLeft: Set<string>, usedRight: Set<string>, count: number): void => {
        if (count + (edges.length - index) <= best) {
            return;
        }
        if (index === edges.length) {
            best = Math.max(best, count);
            return;
        }
        const [l, r] = edges[index]!;
        if (!usedLeft.has(l) && !usedRight.has(r)) {
            usedLeft.add(l);
            usedRight.add(r);
            walk(index + 1, usedLeft, usedRight, count + 1);
            usedLeft.delete(l);
            usedRight.delete(r);
        }
        walk(index + 1, usedLeft, usedRight, count);
    };
    walk(0, new Set<string>(), new Set<string>(), 0);
    return best;
}

function checkFrames(frames: VisualFrame[], nodes: number, edgeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(edgeCount);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Number(frame.meta["matching"])).toBe((frame.meta["pairs"] as string[]).length);
    });
}

describe("Kuhn Bipartite Matching", () => {
    it("finds the true maximum on several bipartite graphs", () => {
        const cases: Array<{ left: string[]; right: string[]; edges: Array<[string, string]> }> = [
            {
                left: ["A", "B", "C", "D"],
                right: ["1", "2", "3", "4"],
                edges: [["A", "1"], ["A", "2"], ["B", "1"], ["B", "3"], ["C", "2"], ["C", "4"], ["D", "3"], ["D", "4"]],
            },
            {
                left: ["A", "B", "C"],
                right: ["1", "2"],
                edges: [["A", "1"], ["A", "2"], ["B", "1"], ["C", "1"]],
            },
            {
                left: ["A", "B", "C"],
                right: ["1", "2", "3"],
                edges: [["A", "1"], ["B", "1"], ["C", "1"]],
            },
            {
                left: ["A", "B"],
                right: ["1", "2", "3"],
                edges: [],
            },
        ];
        for (const testCase of cases) {
            const result = kuhnMatching(testCase.left, testCase.right, testCase.edges);
            expect(result.matchingSize).toBe(bruteForceMaximum(testCase.edges));
            const lefts = result.matchedPairs.map(([l]) => l);
            const rights = result.matchedPairs.map(([, r]) => r);
            expect(new Set(lefts).size).toBe(lefts.length);
            expect(new Set(rights).size).toBe(rights.length);
            for (const [l, r] of result.matchedPairs) {
                expect(testCase.edges.some(([el, er]) => el === l && er === r)).toBe(true);
            }
        }
    });

    it("matches the brute-force answer in the frame metadata", () => {
        const input = mod.defaultInput as {
            left: string[];
            right: string[];
            edges: Array<[string, string]>;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.left.length + input.right.length, input.edges.length);
        const expected = bruteForceMaximum(input.edges);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["matching"])).toBe(expected);
        expect((final?.["pairs"] as string[]).length).toBe(expected);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
