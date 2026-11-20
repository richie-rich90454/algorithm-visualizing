/**
 * crdt-pn-counter.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./crdt-pn-counter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function unflatten(flat: number[], n: number): number[][] {
    return Array.from({ length: n }, (_, row) => flat.slice(row * n, (row + 1) * n));
}

describe("PN-counter CRDT", () => {
    it("matches a brute-force increment-minus-decrement total", () => {
        const input = mod.defaultInput as {
            replicas: number;
            ops: Array<{ replica: number; type: "inc" | "dec"; amount: number }>;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.replicas);
        const expected = input.ops.reduce(
            (sum, op) => sum + (op.type === "inc" ? op.amount : -op.amount),
            0,
        );
        const metaFrame = finalMeta(frames);
        expect(metaFrame["value"]).toBe(expected);
        expect(metaFrame["converged"]).toBe(true);
        const values = metaFrame["values"] as number[];
        for (const value of values) {
            expect(value).toBe(expected);
        }
    });

    it("converges replicas to identical P and N vectors", () => {
        const input = {
            replicas: 4,
            ops: [
                { replica: 0, type: "inc" as const, amount: 7 },
                { replica: 2, type: "inc" as const, amount: 3 },
                { replica: 1, type: "dec" as const, amount: 4 },
                { replica: 2, type: "dec" as const, amount: 6 },
                { replica: 3, type: "inc" as const, amount: 2 },
            ],
            mergeRounds: 3,
        };
        const frames = [...mod.run(input)];
        const metaFrame = finalMeta(frames);
        const n = input.replicas;
        const p = unflatten(metaFrame["pFlat"] as number[], n);
        const negatives = unflatten(metaFrame["negativesFlat"] as number[], n);
        for (let replica = 0; replica < n; replica += 1) {
            for (let component = 0; component < n; component += 1) {
                expect(p[replica]?.[component]).toBe(p[0]?.[component]);
                expect(negatives[replica]?.[component]).toBe(negatives[0]?.[component]);
            }
        }
        expect(p[0]?.[0]).toBe(7);
        expect(p[0]?.[2]).toBe(3);
        expect(p[0]?.[3]).toBe(2);
        expect(negatives[0]?.[1]).toBe(4);
        expect(negatives[0]?.[2]).toBe(6);
        expect(metaFrame["value"]).toBe(7 + 3 + 2 - 4 - 6);
    });

    it("keeps all P and N entries monotone across frames", () => {
        const frames = [...mod.run(mod.defaultInput)];
        let previousP = Array.from({ length: 3 }, () => [0, 0, 0]);
        let previousN = Array.from({ length: 3 }, () => [0, 0, 0]);
        for (const frame of frames) {
            const p = unflatten(frame.meta["pFlat"] as number[], 3);
            const negatives = unflatten(frame.meta["negativesFlat"] as number[], 3);
            for (let r = 0; r < 3; r += 1) {
                for (let c = 0; c < 3; c += 1) {
                    expect(p[r]?.[c] ?? 0).toBeGreaterThanOrEqual(previousP[r]?.[c] ?? 0);
                    expect(negatives[r]?.[c] ?? 0).toBeGreaterThanOrEqual(previousN[r]?.[c] ?? 0);
                }
            }
            previousP = p.map((row) => [...row]);
            previousN = negatives.map((row) => [...row]);
        }
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
