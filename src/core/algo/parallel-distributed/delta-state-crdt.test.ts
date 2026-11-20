/**
 * delta-state-crdt.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./delta-state-crdt";
import type { VisualFrame } from "@/types";

type Delta = { added: string[]; removed: string[] };

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) {
        return [items];
    }
    const out: T[][] = [];
    for (let index = 0; index < items.length; index += 1) {
        const rest = [...items.slice(0, index), ...items.slice(index + 1)];
        for (const restPermutation of permutations(rest)) {
            out.push([items[index] as T, ...restPermutation]);
        }
    }
    return out;
}

function join(deltas: Delta[]): { adds: Set<string>; removes: Set<string> } {
    const adds = new Set<string>();
    const removes = new Set<string>();
    for (const delta of deltas) {
        for (const dot of delta.added) {
            adds.add(dot);
        }
        for (const dot of delta.removed) {
            removes.add(dot);
        }
    }
    return { adds, removes };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Delta-State CRDT", () => {
    it("converges all replicas to the union of every delta", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const input = mod.defaultInput as { replicas: number; operations: unknown[] };
        checkFrames(frames, input.replicas, 2);
        const deltas = frames
            .map((frame) => frame.meta["lastDelta"] as Delta | undefined)
            .filter((delta): delta is Delta => Boolean(delta));
        expect(deltas).toHaveLength(input.operations.length);
        const expected = join(deltas);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["converged"]).toBe(true);
        const adds = last?.["adds"] as string[][];
        const removes = last?.["removes"] as string[][];
        for (const set of adds) {
            expect([...set].sort()).toEqual([...expected.adds].sort());
        }
        for (const set of removes) {
            expect([...set].sort()).toEqual([...expected.removes].sort());
        }
    });

    it("is order independent and idempotent under every delivery permutation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const deltas = frames
            .map((frame) => frame.meta["lastDelta"] as Delta | undefined)
            .filter((delta): delta is Delta => Boolean(delta));
        const reference = join(deltas);
        for (const order of permutations(deltas)) {
            const result = join(order);
            expect([...result.adds].sort()).toEqual([...reference.adds].sort());
            expect([...result.removes].sort()).toEqual([...reference.removes].sort());
        }
        const duplicated = join([...deltas, ...deltas]);
        expect([...duplicated.adds].sort()).toEqual([...reference.adds].sort());
        expect([...duplicated.removes].sort()).toEqual([...reference.removes].sort());
    });

    it("reports the expected visible elements", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1]?.meta;
        const present = last?.["present"] as boolean[][];
        const firstReplica = present[0] ?? [];
        expect(firstReplica).toHaveLength(2);
        expect(everyReplicaEqual(present)).toBe(true);
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

function everyReplicaEqual(present: boolean[][]): boolean {
    const first = JSON.stringify(present[0]);
    return present.every((row) => JSON.stringify(row) === first);
}
