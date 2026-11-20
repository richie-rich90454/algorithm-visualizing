/**
 * yata.test.ts - Convergence over every insertion permutation, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./yata";
import type { VisualFrame } from "@/types";

type Id = [number, number];
interface Element {
    id: Id;
    origin: Id | null;
    value: number;
}

function sameId(a: Id | null, b: Id | null): boolean {
    if (a === null || b === null) return a === b;
    return a[0] === b[0] && a[1] === b[1];
}

function idLess(a: Id, b: Id): boolean {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/** Independent reference integration function for YATA. */
function integrate(sequence: Element[], element: Element): boolean {
    if (sequence.length === 0 && element.origin === null) {
        sequence.push(element);
        return true;
    }
    if (element.origin === null) {
        sequence.unshift(element);
        return true;
    }
    let index = sequence.findIndex((item) => sameId(item.id, element.origin));
    if (index < 0) return false;
    index += 1;
    while (
        index < sequence.length &&
        sameId(sequence[index]!.origin, element.origin) &&
        idLess(element.id, sequence[index]!.id)
    ) {
        index += 1;
    }
    sequence.splice(index, 0, element);
    return true;
}

function integrateAll(elements: Element[]): Element[] {
    const sequence: Element[] = [];
    const pending = [...elements];
    while (pending.length) {
        let progressed = false;
        for (let i = 0; i < pending.length; ) {
            if (integrate(sequence, pending[i]!)) {
                pending.splice(i, 1);
                progressed = true;
            } else {
                i += 1;
            }
        }
        if (!progressed) break;
    }
    return sequence;
}

/** All permutations of a small array, for an exhaustive convergence check. */
function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += 1) {
        const rest = [...items.slice(0, i), ...items.slice(i + 1)];
        for (const tail of permutations(rest)) {
            result.push([items[i]!, ...tail]);
        }
    }
    return result;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThanOrEqual(0);
        expect(frame.entities.length).toBeLessThanOrEqual(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("YATA sequence CRDT", () => {
    const input = mod.defaultInput as { elements: Element[] };
    const elements = input.elements;

    it("converges to one sequence over all 24 insertion orders", () => {
        const orders = permutations(elements);
        expect(orders.length).toBe(24);
        const canonical = integrateAll(elements).map((e) => e.value).join(",");
        for (const order of orders) {
            const result = integrateAll(order).map((e) => e.value).join(",");
            expect(result).toBe(canonical);
        }
    });

    it("matches the reference on the default insertion order", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, elements.length);
        const expected = integrateAll(elements).map((e) => String(e.value));
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["sequence"]).toEqual(expected);
        expect(final?.["pending"]).toBe(0);
        expect(final?.["converged"]).toBe(true);
    });

    it("keeps larger identifiers before concurrent smaller ones", () => {
        const concurrent: Element[] = [
            { id: [0, 1], origin: null, value: 1 },
            { id: [1, 1], origin: [0, 1], value: 2 },
            { id: [2, 1], origin: [0, 1], value: 3 },
        ];
        const sequence = integrateAll(concurrent).map((e) => e.value);
        expect(sequence).toEqual([1, 3, 2]);
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
