/**
 * priority-search-tree.test.ts - Brute-force query correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./priority-search-tree";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    }
}

function bruteForce(points: Point[], xlo: number, xhi: number, ytho: number): Point[] {
    return points.filter((p) => p[0] >= xlo && p[0] <= xhi && p[1] >= ytho);
}

function sortedPairs(points: Point[]): string {
    return points.map((p) => `${p[0]},${p[1]}`).sort().join("|");
}

describe("Priority Search Tree", () => {
    it("matches brute force on the default input", () => {
        const input = mod.defaultInput as { points: Point[]; xlo: number; xhi: number; ytho: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const flat = final?.["result"] as number[];
        const got: Point[] = [];
        for (let i = 0; i < flat.length; i += 2) {
            got.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
        }
        expect(sortedPairs(got)).toBe(sortedPairs(bruteForce(input.points, input.xlo, input.xhi, input.ytho)));
        expect(final?.["resultCount"]).toBe(bruteForce(input.points, input.xlo, input.xhi, input.ytho).length);
    });

    it("matches brute force on many random point sets and queries", () => {
        let seed = 7;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const points: Point[] = [];
            const n = 5 + Math.floor(rand() * 10);
            for (let i = 0; i < n; i += 1) {
                points.push([Math.floor(rand() * 12), Math.floor(rand() * 12)]);
            }
            const xlo = Math.floor(rand() * 12);
            const xhi = xlo + Math.floor(rand() * 6);
            const ytho = Math.floor(rand() * 12);
            const frames = [...mod.run({ points, xlo, xhi, ytho })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const flat = final?.["result"] as number[];
            const got: Point[] = [];
            for (let i = 0; i < flat.length; i += 2) {
                got.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
            }
            expect(sortedPairs(got)).toBe(sortedPairs(bruteForce(points, xlo, xhi, ytho)));
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
