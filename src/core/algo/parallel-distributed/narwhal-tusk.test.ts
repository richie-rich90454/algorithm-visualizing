/**
 * narwhal-tusk.test.ts - DAG order properties, quorum, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateNarwhalTusk } from "./narwhal-tusk";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], nodes: number, rounds: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes * rounds);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["quorum"]).toBe(2 * Math.floor((nodes - 1) / 3) + 1);
    });
}

describe("Narwhal and Tusk", () => {
    it("uses the Byzantine quorum 2f+1", () => {
        for (const nodes of [4, 7, 10, 13]) {
            const result = simulateNarwhalTusk(nodes, 3, 1);
            expect(result.f).toBe(Math.floor((nodes - 1) / 3));
            expect(result.quorum).toBe(2 * result.f + 1);
        }
    });

    it("certifies only live nodes reaching quorum", () => {
        const nodes = 7;
        const result = simulateNarwhalTusk(nodes, 3, 5, [0, 1, 2]);
        expect(result.f).toBe(2);
        expect(result.quorum).toBe(5);
        for (let round = 0; round < result.rounds; round += 1) {
            result.certified[round]?.forEach((certified, node) => {
                const votes = result.votes[round]?.[node] ?? 0;
                expect(certified).toBe(votes >= result.quorum);
                if ([0, 1, 2].includes(node)) {
                    expect(certified).toBe(false);
                }
            });
        }
    });

    it("produces a parent-before-child order with no duplicates", () => {
        for (const seed of [1, 2, 3, 9, 42]) {
            const nodes = 7;
            const rounds = 6;
            const result = simulateNarwhalTusk(nodes, rounds, seed);
            const keys = result.order.map((item) => `${item.round}:${item.node}`);
            expect(new Set(keys).size).toBe(keys.length);
            const position = new Map(keys.map((key, index) => [key, index]));
            for (const item of result.order) {
                for (const parent of result.parents[item.round]?.[item.node] ?? []) {
                    const parentKey = `${item.round - 1}:${parent}`;
                    if (position.has(parentKey)) {
                        expect(position.get(parentKey) as number).toBeLessThan(position.get(`${item.round}:${item.node}`) as number);
                    }
                }
            }
            expect(result.order.length).toBeGreaterThan(0);
        }
    });

    it("emits a final order independent of frame timing", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4, 4);
        const final = frames[frames.length - 1]?.meta;
        const order = final?.["order"] as string[];
        expect(order).toEqual(simulateNarwhalTusk(4, 4, 3).order.map((item) => `r${item.round}n${item.node}`));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
