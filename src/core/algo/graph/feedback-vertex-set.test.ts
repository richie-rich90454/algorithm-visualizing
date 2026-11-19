/**
 * feedback-vertex-set.test.ts - Brute-force minimum check, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./feedback-vertex-set";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

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

function hasCycle(adjacency: Adj, removed: Set<string>): boolean {
    const color = new Map<string, number>();
    const visit = (v: string): boolean => {
        color.set(v, 1);
        for (const next of adjacency[v] ?? []) {
            if (removed.has(String(next))) {
                continue;
            }
            const state = color.get(String(next)) ?? 0;
            if (state === 1 || (state === 0 && visit(String(next)))) {
                return true;
            }
        }
        color.set(v, 2);
        return false;
    };
    for (const v of Object.keys(adjacency)) {
        if (!removed.has(v) && (color.get(v) ?? 0) === 0 && visit(v)) {
            return true;
        }
    }
    return false;
}

function bruteForceMinimum(adjacency: Adj): number {
    const vertices = Object.keys(adjacency);
    for (let size = 0; size <= vertices.length; size += 1) {
        const indices = vertices.map((_v, i) => i);
        const combinations: number[][] = [];
        const build = (start: number, chosen: number[]): void => {
            if (chosen.length === size) {
                combinations.push([...chosen]);
                return;
            }
            for (let i = start; i < indices.length; i += 1) {
                const value = indices[i];
                if (value === undefined) {
                    continue;
                }
                build(i + 1, [...chosen, value]);
            }
        };
        build(0, []);
        for (const combo of combinations) {
            const removed = new Set(combo.map((i) => vertices[i] ?? ""));
            if (!hasCycle(adjacency, removed)) {
                return size;
            }
        }
    }
    return vertices.length;
}

describe("Feedback Vertex Set", () => {
    it("matches brute force on several directed graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B"], B: ["C"], C: ["A", "D"], D: [] },
            { A: ["B", "C"], B: ["C", "A"], C: ["A", "B"] },
            { A: ["B"], B: ["A", "C"], C: ["D"], D: ["C"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const answer = meta?.["bestSet"] as string[];
            expect(hasCycle(adjacency, new Set(answer))).toBe(false);
            expect(answer.length).toBe(bruteForceMinimum(adjacency));
            expect(meta?.["bestSize"]).toBe(answer.length);
        }
    });

    it("returns an empty set for a dag", () => {
        const adjacency: Adj = { A: ["B", "C"], B: ["D"], C: ["D"], D: [] };
        const frames = [...mod.run({ adjacency })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["bestSize"]).toBe(0);
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
