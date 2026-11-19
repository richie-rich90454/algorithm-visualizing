/** flow-decomposition.test.ts - Reconstruction property check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import flowDecomposition from "./flow-decomposition";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(flowDecomposition.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.meta).toBeTypeOf("object");
        frame.edges.forEach((edge) => {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

describe("Flow Decomposition", () => {
    it("reconstructs the original edge flows from the peeled pieces", () => {
        const input = flowDecomposition.defaultInput as {
            source: string;
            sink: string;
            edges: Array<{ u: string; v: string; capacity: number; flow: number }>;
        };
        const frames = sumAll(flowDecomposition.run(input));
        const final = frames[frames.length - 1];
        const reconstructed = new Map<string, number>();
        const pieces = [...(final?.meta["paths"] as string[]), ...(final?.meta["cycles"] as string[])];
        for (const piece of pieces) {
            const separator = piece.indexOf(":");
            const amount = Number(piece.slice(0, separator));
            const keys = piece.slice(separator + 1).split(" ");
            for (const key of keys) {
                reconstructed.set(key, (reconstructed.get(key) ?? 0) + amount);
            }
        }
        for (const arc of input.edges) {
            expect(reconstructed.get(`${arc.u}->${arc.v}`) ?? 0).toBe(arc.flow);
        }
        const pathAmounts = (final?.meta["paths"] as string[]).map((piece) => Number(piece.split(":")[0]));
        const total = pathAmounts.reduce((sum, amount) => sum + amount, 0);
        const sourceOut = input.edges
            .filter((arc) => arc.u === input.source)
            .reduce((sum, arc) => sum + arc.flow, 0);
        expect(total).toBe(sourceOut);
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(flowDecomposition.run(flowDecomposition.defaultInput)));
        const generator = flowDecomposition.run(flowDecomposition.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
