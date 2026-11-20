/**
 * preflow-push-graph-matching.test.ts - Maximum-matching cross-check and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./preflow-push-graph-matching";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

/** Independent Kuhn augmenting-path reference for maximum bipartite matching. */
function maxMatchingSize(left: string[], right: string[], edges: Edge[]): number {
    const adj = new Map(left.map((v) => [v, [] as string[]]));
    for (const [u, v] of edges) {
        adj.get(u)?.push(v);
    }
    const owner = new Map<string, string>();
    const tryAssign = (u: string, seen: Set<string>): boolean => {
        for (const v of adj.get(u) ?? []) {
            if (seen.has(v)) {
                continue;
            }
            seen.add(v);
            const holder = owner.get(v);
            if (holder === undefined || tryAssign(holder, seen)) {
                owner.set(v, u);
                return true;
            }
        }
        return false;
    };
    let size = 0;
    for (const u of left) {
        if (tryAssign(u, new Set())) {
            size += 1;
        }
    }
    return size;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Maximum bipartite matching by preflow-push", () => {
    it("matches the augmenting-path reference on the default input", () => {
        const input = mod.defaultInput as { left: string[]; right: string[]; edges: Edge[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const matching = final["matching"] as string[];
        expect(matching.length).toBe(maxMatchingSize(input.left, input.right, input.edges));
    });

    it("returns only real, conflict-free pairs on random inputs", () => {
        let seed = 43;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (let t = 0; t < 8; t += 1) {
            const left = ["a", "b", "c", "d", "e"].slice(0, 2 + Math.floor(rand() * 4));
            const right = ["1", "2", "3", "4", "5"].slice(0, 2 + Math.floor(rand() * 4));
            const edges: Edge[] = [];
            for (const u of left) {
                for (const v of right) {
                    if (rand() < 0.45) {
                        edges.push([u, v]);
                    }
                }
            }
            const frames = [...mod.run({ left, right, edges })];
            checkFrames(frames);
            const matching = frames[frames.length - 1]!.meta["matching"] as string[];
            expect(matching.length).toBe(maxMatchingSize(left, right, edges));
            const usedLeft = new Set<string>();
            const usedRight = new Set<string>();
            for (const pair of matching) {
                const [u, v] = pair.split("-");
                expect(edges.some(([a, b]) => a === u && b === v)).toBe(true);
                expect(usedLeft.has(u!)).toBe(false);
                expect(usedRight.has(v!)).toBe(false);
                usedLeft.add(u!);
                usedRight.add(v!);
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
