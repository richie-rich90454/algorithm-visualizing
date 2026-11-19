/**
 * kempe-chain-coloring.test.ts - Independent chain computation, proper-coloring
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kempe-chain-coloring";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
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

interface Case {
    graph: Adj;
    colors: Record<string, number>;
    vertex: string;
    colorA: number;
    colorB: number;
}

function referenceChain(test: Case): { chain: string[]; result: Record<string, number> } {
    const labels = [...new Set([...Object.keys(test.graph), ...Object.values(test.graph).flat()])].sort();
    const result: Record<string, number> = { ...test.colors };
    const inColors = (v: string): boolean => result[v] === test.colorA || result[v] === test.colorB;
    const chain = new Set<string>();
    if (inColors(test.vertex)) {
        chain.add(test.vertex);
        const queue = [test.vertex];
        while (queue.length > 0) {
            const v = queue.shift() as string;
            for (const u of test.graph[v] ?? []) {
                if (!labels.includes(String(u)) || chain.has(String(u)) || !inColors(String(u))) {
                    continue;
                }
                chain.add(String(u));
                queue.push(String(u));
            }
        }
    }
    for (const v of chain) {
        result[v] = result[v] === test.colorA ? test.colorB : test.colorA;
    }
    return { chain: [...chain].sort(), result };
}

function isProper(graph: Adj, colors: Record<string, number>): boolean {
    for (const a of Object.keys(colors)) {
        for (const b of graph[a] ?? []) {
            if (colors[a] === colors[String(b)]) {
                return false;
            }
        }
    }
    return true;
}

describe("Kempe Chain Color Exchange", () => {
    it("matches an independent chain computation and stays proper", () => {
        const cases: Case[] = [
            mod.defaultInput as Case,
            {
                graph: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"], D: ["C"] },
                colors: { A: 0, B: 1, C: 2, D: 0 },
                vertex: "D",
                colorA: 0,
                colorB: 2,
            },
            {
                graph: { A: ["B"], B: ["A", "C"], C: ["B"] },
                colors: { A: 0, B: 1, C: 0 },
                vertex: "A",
                colorA: 0,
                colorB: 1,
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const expected = referenceChain(testCase);
            expect(meta?.["chain"]).toEqual(expected.chain);
            const labels = [...new Set([...Object.keys(testCase.graph), ...Object.values(testCase.graph).flat()])].sort();
            const result: Record<string, number> = {};
            (meta?.["resultColors"] as number[]).forEach((c, i) => {
                result[labels[i] as string] = c;
            });
            expect(result).toEqual(expected.result);
            expect(isProper(testCase.graph, result)).toBe(true);
        }
    });

    it("is an involution when swapped twice", () => {
        const testCase = mod.defaultInput as Case;
        const frames = [...mod.run(testCase)];
        const meta = frames[frames.length - 1]?.meta;
        const labels = Object.keys(testCase.colors).sort();
        const first: Record<string, number> = {};
        (meta?.["resultColors"] as number[]).forEach((c, i) => {
            first[labels[i] as string] = c;
        });
        const second = [...mod.run({ ...testCase, colors: first })];
        const meta2 = second[second.length - 1]?.meta;
        const restored: Record<string, number> = {};
        (meta2?.["resultColors"] as number[]).forEach((c, i) => {
            restored[labels[i] as string] = c;
        });
        expect(restored).toEqual(testCase.colors);
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
