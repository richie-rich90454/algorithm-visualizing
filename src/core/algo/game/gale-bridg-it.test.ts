/** gale-bridg-it.test.ts - Independent minimax cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./gale-bridg-it";

const DEFAULT_EDGES: Array<[number, number]> = [
    [0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 5], [4, 5],
];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Separate exhaustive minimax written directly over edge-index sets. */
function independentWinner(edges: Array<[number, number]>, source: number, sink: number): boolean {
    const total = edges.length;
    const joined = (short: Set<number>): boolean => {
        const graph = new Map<number, number[]>();
        edges.forEach(([u, v], index) => {
            if (!short.has(index)) return;
            graph.set(u, [...(graph.get(u) ?? []), v]);
            graph.set(v, [...(graph.get(v) ?? []), u]);
        });
        const seen = new Set([source]);
        const stack = [source];
        while (stack.length) {
            const current = stack.pop()!;
            if (current === sink) return true;
            for (const neighbor of graph.get(current) ?? []) {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    stack.push(neighbor);
                }
            }
        }
        return false;
    };
    const memo = new Map<string, boolean>();
    const solve = (short: Set<number>, cut: Set<number>): boolean => {
        if (joined(short)) return true;
        const free = edges.map((_, index) => index).filter((index) => !short.has(index) && !cut.has(index));
        if (free.length === 0) return false;
        const key = `${[...short].join("")}|${[...cut].join("")}`;
        if (memo.has(key)) return memo.get(key)!;
        const shortTurn = free.length % 2 === total % 2;
        let result: boolean;
        if (shortTurn) {
            result = false;
            for (const index of free) {
                const next = new Set(short);
                next.add(index);
                if (solve(next, cut)) {
                    result = true;
                    break;
                }
            }
        } else {
            result = true;
            for (const index of free) {
                const next = new Set(cut);
                next.add(index);
                if (!solve(short, next)) {
                    result = false;
                    break;
                }
            }
        }
        memo.set(key, result);
        return result;
    };
    return solve(new Set(), new Set());
}

describe("Gale's Bridg-It", () => {
    it("agrees with an independent exhaustive solver", () => {
        const cases: Array<{ edges: Array<[number, number]>; source: number; sink: number }> = [
            { edges: DEFAULT_EDGES, source: 0, sink: 5 },
            { edges: [[0, 1], [1, 2], [2, 3]], source: 0, sink: 3 },
            { edges: [[0, 1], [0, 2], [1, 3], [2, 3]], source: 0, sink: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            expect(frames[0]?.meta["shortWins"]).toBe(independentWinner(testCase.edges, testCase.source, testCase.sink));
        }
    });

    it("decides a forced cut win on a three-link path", () => {
        const frames = [...mod.run({ edges: [[0, 1], [1, 2], [2, 3]], source: 0, sink: 3 })];
        checkFrames(frames);
        expect(frames[0]?.meta["shortWins"]).toBe(false);
        expect(frames[frames.length - 1]?.meta["winner"]).toBe("cut");
    });

    it("terminates with edges claimed at most once", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const shortMask = Number(last?.["shortMask"]);
        const cutMask = Number(last?.["cutMask"]);
        expect(shortMask & cutMask).toBe(0);
        expect(frames.length).toBeLessThanOrEqual(10);
        expect(generator.next().done).toBe(true);
    });
});
