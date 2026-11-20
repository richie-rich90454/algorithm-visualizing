/**
 * dynamic-transitive-closure.test.ts - Property check against a fully
 * recomputed closure after every update, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dynamic-transitive-closure";
import type { VisualFrame } from "@/types";

interface Update {
    from: string;
    to: string;
    add: boolean;
}

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

/** Independent reference: full closure from scratch by BFS from every vertex. */
function closurePairs(vertices: string[], edges: Set<string>): number {
    let pairs = 0;
    for (const start of vertices) {
        const seen = new Set<string>();
        const queue: string[] = [];
        for (const v of vertices) {
            if (edges.has(`${start}->${v}`)) {
                seen.add(v);
                queue.push(v);
            }
        }
        while (queue.length > 0) {
            const u = queue.shift();
            if (u === undefined) {
                continue;
            }
            for (const v of vertices) {
                if (!seen.has(v) && edges.has(`${u}->${v}`)) {
                    seen.add(v);
                    queue.push(v);
                }
            }
        }
        pairs += seen.size;
    }
    return pairs;
}

describe("Dynamic Transitive Closure", () => {
    it("matches full recomputation after every update", () => {
        const input = mod.defaultInput as { vertices: string[]; updates: Update[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const edges = new Set<string>();
        const expectedAfter = [closurePairs(input.vertices, edges)];
        for (const update of input.updates) {
            const key = `${update.from}->${update.to}`;
            if (update.add) {
                edges.add(key);
            } else {
                edges.delete(key);
            }
            expectedAfter.push(closurePairs(input.vertices, edges));
        }
        for (const frame of frames.slice(0, expectedAfter.length)) {
            expect(frame.meta["reachablePairs"]).toBe(expectedAfter[Number(frame.meta["updateIndex"])]);
        }
        expect(frames[frames.length - 1]?.meta["reachablePairs"]).toBe(expectedAfter[expectedAfter.length - 1]);
    });

    it("handles insertions that create new cycles", () => {
        const vertices = ["A", "B", "C"];
        const updates: Update[] = [
            { from: "A", to: "B", add: true },
            { from: "B", to: "C", add: true },
            { from: "C", to: "A", add: true },
            { from: "A", to: "C", add: true },
            { from: "C", to: "A", add: false },
        ];
        const frames = [...mod.run({ vertices, updates })];
        checkFrames(frames);
        const edges = new Set<string>();
        const expectedAfter = [closurePairs(vertices, edges)];
        for (const update of updates) {
            const key = `${update.from}->${update.to}`;
            if (update.add) {
                edges.add(key);
            } else {
                edges.delete(key);
            }
            expectedAfter.push(closurePairs(vertices, edges));
        }
        for (const frame of frames.slice(0, expectedAfter.length)) {
            expect(frame.meta["reachablePairs"]).toBe(expectedAfter[Number(frame.meta["updateIndex"])]);
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
