/**
 * crdt-lww-register.test.ts - Convergence, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./crdt-lww-register";
import type { VisualFrame } from "@/types";

interface Update {
    replica: number;
    value: number;
}

function checkFrames(frames: VisualFrame[], replicas: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(replicas);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** The value with the greatest (counter, replicaId) timestamp wins. */
function expectedWinner(replicas: number, updates: Update[]): { value: number; counter: number; replicaId: number } {
    const counters = Array.from({ length: replicas }, () => 0);
    let best = { value: -1, counter: 0, replicaId: -1 };
    for (const update of updates) {
        const replica = ((update.replica % replicas) + replicas) % replicas;
        counters[replica]! += 1;
        const candidate = { value: update.value, counter: counters[replica]!, replicaId: replica };
        if (
            candidate.counter > best.counter ||
            (candidate.counter === best.counter && candidate.replicaId > best.replicaId)
        ) {
            best = candidate;
        }
    }
    return best;
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0;
        return state / 0x100000000;
    };
}

describe("LWW Register CRDT", () => {
    it("converges to the greatest timestamp across randomized updates", () => {
        const random = makeRandom(19);
        for (let trial = 0; trial < 150; trial += 1) {
            const replicas = 2 + Math.floor(random() * 4);
            const updateCount = 1 + Math.floor(random() * 8);
            const updates: Update[] = Array.from({ length: updateCount }, () => ({
                replica: Math.floor(random() * replicas),
                value: Math.floor(random() * 100),
            }));
            const frames = [...mod.run({ replicas, updates })];
            checkFrames(frames, replicas);
            const finalMeta = frames[frames.length - 1]!.meta;
            const expected = expectedWinner(replicas, updates);
            expect(finalMeta["converged"]).toBe(true);
            expect(finalMeta["value"]).toBe(expected.value);
            expect(finalMeta["timestamp"]).toBe(expected.counter);
            expect(finalMeta["replicaId"]).toBe(expected.replicaId);

            const finalCells = frames[frames.length - 1]!.entities;
            const values = new Set(finalCells.map((cell) => cell.value));
            expect(values.size).toBe(1);
            expect(values.has(expected.value)).toBe(true);
        }
    });

    it("resolves counter ties by the larger replica id", () => {
        const replicas = 3;
        const updates: Update[] = [
            { replica: 0, value: 5 },
            { replica: 1, value: 9 },
            { replica: 2, value: 3 },
        ];
        const frames = [...mod.run({ replicas, updates })];
        expect(frames[frames.length - 1]!.meta["value"]).toBe(3);
        expect(expectedWinner(replicas, updates).value).toBe(3);
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
