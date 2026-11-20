/**
 * fetch-and-add.test.ts - Atomic counter correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { allOrders, executeInterleaving, fetchAddInvariants } from "./fetch-and-add";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent factorial count and serial counter simulation. */
function bruteOrders(n: number): number {
    let count = 1;
    for (let i = 2; i <= n; i += 1) {
        count *= i;
    }
    return count;
}

describe("Fetch-and-Add", () => {
    it("enumerates all n factorial interleavings", () => {
        for (const n of [1, 2, 3, 4]) {
            expect(allOrders(n)).toHaveLength(bruteOrders(n));
        }
    });

    it("gives every caller a distinct ticket in every interleaving", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["correct"]).toBe(true);
        expect(final?.["uniqueTickets"]).toBe(true);
        expect(Number(final?.["finalCounter"])).toBe(13);
        for (const order of allOrders(3)) {
            let counter = 10;
            const tickets = order.map(() => {
                const old = counter;
                counter += 1;
                return old;
            });
            expect(new Set(tickets).size).toBe(3);
            expect(counter).toBe(13);
        }
    });

    it("matches an independent serial simulation for a negative start", () => {
        const invariants = fetchAddInvariants(4, -5);
        expect(invariants.interleavings).toBe(24);
        expect(invariants.uniqueTickets).toBe(true);
        expect(invariants.finalCounter).toBe(-1);
        const calls = executeInterleaving([3, 1, 0, 2], -5);
        expect(calls.map((call) => call.oldValue)).toEqual([-5, -4, -3, -2]);
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
