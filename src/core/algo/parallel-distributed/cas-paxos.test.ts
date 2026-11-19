/**
 * cas-paxos.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cas-paxos";
import type { VisualFrame } from "@/types";

interface CasOp {
    expected: number;
    next: number;
}

/** Independent abstract compare-and-swap register. */
function reference(initial: number, operations: CasOp[]) {
    let current = initial;
    let successes = 0;
    const accepted: number[] = [];
    for (const op of operations) {
        if (current === op.expected) {
            current = op.next;
            successes += 1;
            accepted.push(op.next);
        }
    }
    return { current, successes, accepted };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CAS Paxos", () => {
    it("matches an abstract compare-and-swap register", () => {
        const input = mod.defaultInput as { acceptors: number; initial: number; operations: CasOp[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.initial, input.operations);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["current"]).toBe(expected.current);
        expect(last?.["successes"]).toBe(expected.successes);
        expect(last?.["accepted"]).toEqual(expected.accepted);
    });

    it("never changes the register on a failed compare", () => {
        const ops: CasOp[] = [
            { expected: 0, next: 1 },
            { expected: 42, next: 99 },
        ];
        const frames = [...mod.run({ initial: 0, operations: ops })];
        const failed = frames.find((frame) => frame.description.includes("Compare failed"));
        expect(failed).toBeDefined();
        expect(failed?.meta["current"]).toBe(1);
        expect(frames[frames.length - 1]?.meta["current"]).toBe(1);
        expect(frames[frames.length - 1]?.meta["successes"]).toBe(1);
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
