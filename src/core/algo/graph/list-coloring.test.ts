/**
 * list-coloring.test.ts - Brute-force feasibility check, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./list-coloring";
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

function bruteForceFeasible(adjacency: Adj, lists: Record<string, number[]>): boolean {
    const vertices = Object.keys(adjacency);
    const assign = new Map<string, number>();
    const search = (index: number): boolean => {
        if (index >= vertices.length) {
            return true;
        }
        const v = vertices[index];
        if (v === undefined) {
            return false;
        }
        for (const color of lists[v] ?? []) {
            let ok = true;
            for (const u of adjacency[v] ?? []) {
                if (assign.get(String(u)) === color) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                assign.set(v, color);
                if (search(index + 1)) {
                    return true;
                }
                assign.delete(v);
            }
        }
        return false;
    };
    return search(0);
}

describe("List Coloring", () => {
    it("matches brute force on feasible and infeasible instances", () => {
        const cases: Array<{ adjacency: Adj; lists: Record<string, number[]> }> = [
            {
                adjacency: (mod.defaultInput as { adjacency: Adj }).adjacency,
                lists: (mod.defaultInput as { lists: Record<string, number[]> }).lists,
            },
            { adjacency: { A: ["B"], B: ["A"] }, lists: { A: [1, 2], B: [1] } },
            { adjacency: { A: ["B"], B: ["A"] }, lists: { A: [1], B: [1] } },
            { adjacency: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] }, lists: { A: [1], B: [2], C: [3] } },
            { adjacency: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] }, lists: { A: [1], B: [2], C: [1, 2] } },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["feasible"]).toBe(bruteForceFeasible(testCase.adjacency, testCase.lists));
            if (meta?.["feasible"]) {
                const coloring = new Map(
                    (meta["assignment"] as string[]).map((entry) => {
                        const [v, c] = entry.split(":");
                        return [v ?? "", Number(c)] as const;
                    }),
                );
                for (const v of Object.keys(testCase.adjacency)) {
                    expect(testCase.lists[v] ?? []).toContain(coloring.get(v));
                    for (const u of testCase.adjacency[v] ?? []) {
                        expect(coloring.get(v)).not.toBe(coloring.get(String(u)));
                    }
                }
            }
        }
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
