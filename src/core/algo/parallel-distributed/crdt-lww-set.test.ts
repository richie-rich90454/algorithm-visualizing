/**
 * crdt-lww-set.test.ts - Merge lattice laws, lookup, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { applyOperation, fromOperations, lookup, mergeLWW, tagCompare } from "./crdt-lww-set";
import type { LWWSet, Operation } from "./crdt-lww-set";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

const ops = (seed: number): Operation[] => {
    const elements = ["a", "b", "c", "d"];
    let state = seed >>> 0;
    const next = () => {
        state = (state * 1103515245 + 12345) >>> 0;
        return state / 4294967296;
    };
    return Array.from({ length: 40 }, () => {
        const replica = next() < 0.5 ? 0 : 1;
        const action = next() < 0.5 ? "add" : "remove";
        const element = elements[Math.floor(next() * elements.length)] as string;
        const timestamp = 1 + Math.floor(next() * 12);
        return { replica, action, element, timestamp } as Operation;
    });
};

describe("LWW-element-set CRDT", () => {
    it("tag comparison breaks ties by replica id", () => {
        expect(tagCompare({ timestamp: 1, replica: 2 }, { timestamp: 2, replica: 0 })).toBeLessThan(0);
        expect(tagCompare({ timestamp: 3, replica: 0 }, { timestamp: 3, replica: 1 })).toBeLessThan(0);
        expect(tagCompare(undefined, { timestamp: 1, replica: 0 })).toBeLessThan(0);
    });

    it("lookup uses the newest tag and honors the add-wins tie rule", () => {
        const set: LWWSet = {
            adds: { a: { timestamp: 4, replica: 0 }, b: { timestamp: 2, replica: 0 } },
            removes: { a: { timestamp: 3, replica: 1 }, b: { timestamp: 2, replica: 1 } },
        };
        expect(lookup(set, "a")).toBe(true);
        expect(lookup(set, "b", true)).toBe(true);
        expect(lookup(set, "b", false)).toBe(false);
        expect(lookup(set, "missing")).toBe(false);
    });

    it("merge is commutative, associative, and idempotent", () => {
        for (const seed of [1, 2, 3, 7, 11]) {
            const all = ops(seed);
            const setA = fromOperations(all.filter((op) => op.replica === 0));
            const setB = fromOperations(all.filter((op) => op.replica === 1));
            const setC = fromOperations(all.filter((op) => op.timestamp % 2 === 0));
            expect(mergeLWW(setA, setB)).toEqual(mergeLWW(setB, setA));
            expect(mergeLWW(mergeLWW(setA, setB), setC)).toEqual(mergeLWW(setA, mergeLWW(setB, setC)));
            expect(mergeLWW(setA, setA)).toEqual(setA);
        }
    });

    it("converges to the same membership regardless of delivery order", () => {
        const all = ops(42);
        const replicaA: LWWSet = { adds: {}, removes: {} };
        const replicaB: LWWSet = { adds: {}, removes: {} };
        for (const op of all) {
            applyOperation(op.replica === 0 ? replicaA : replicaB, op);
        }
        const mergedAB = mergeLWW(replicaA, replicaB);
        const mergedBA = mergeLWW(replicaB, replicaA);
        const elements = ["a", "b", "c", "d"];
        for (const element of elements) {
            expect(lookup(mergedAB, element)).toBe(lookup(mergedBA, element));
        }
        const unionSet = fromOperations(all);
        for (const element of elements) {
            expect(lookup(mergedAB, element)).toBe(lookup(unionSet, element));
        }
    });

    it("reports converged membership in its final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        expect(final?.["phase"]).toBe("done");
        expect(Array.isArray(final?.["finalSet"])).toBe(true);
        expect(final?.["finalSet"]).toContain("a");
        expect(final?.["finalSet"]).toContain("b");
        expect(final?.["finalSet"]).toContain("c");
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
