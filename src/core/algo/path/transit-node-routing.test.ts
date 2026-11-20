/**
 * transit-node-routing.test.ts - Floyd-Warshall cross-check and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./transit-node-routing";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function floydWarshall(graph: Graph): Map<string, number> {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flatMap((l) => l.map(([v]) => v))])];
    const index = new Map(labels.map((v, i) => [v, i]));
    const d = labels.map((_, i) => labels.map((_, j) => (i === j ? 0 : Infinity)));
    for (const [u, list] of Object.entries(graph)) {
        for (const [v, w] of list) {
            d[index.get(u)!]![index.get(v)!] = Math.min(d[index.get(u)!]![index.get(v)!] ?? Infinity, w);
        }
    }
    for (let k = 0; k < labels.length; k += 1) {
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = 0; j < labels.length; j += 1) {
                d[i]![j] = Math.min(d[i]![j] ?? Infinity, (d[i]![k] ?? Infinity) + (d[k]![j] ?? Infinity));
            }
        }
    }
    const out = new Map<string, number>();
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = 0; j < labels.length; j += 1) {
            out.set(`${labels[i]}->${labels[j]}`, d[i]![j]!);
        }
    }
    return out;
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

describe("Transit node routing", () => {
    it("is exact with every vertex as a transit node", () => {
        const input = mod.defaultInput as { graph: Graph; queries: Array<[string, string]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const truth = floydWarshall(input.graph);
        const final = frames[frames.length - 1]!.meta;
        const queries = final["queries"] as string[];
        const answers = final["answers"] as number[];
        queries.forEach((q, i) => {
            const exact = truth.get(q) ?? Infinity;
            expect(answers[i]).toBe(Number.isFinite(exact) ? exact : -1);
        });
    });

    it("gives upper bounds with a restricted access set", () => {
        const input = mod.defaultInput as { graph: Graph; queries: Array<[string, string]> };
        const frames = [...mod.run({ graph: input.graph, queries: input.queries, accessCount: 1 })];
        checkFrames(frames);
        const truth = floydWarshall(input.graph);
        const final = frames[frames.length - 1]!.meta;
        const queries = final["queries"] as string[];
        const answers = final["answers"] as number[];
        queries.forEach((q, i) => {
            const exact = truth.get(q) ?? Infinity;
            if (Number.isFinite(exact)) {
                expect(answers[i]).toBeGreaterThanOrEqual(exact);
            }
        });
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
