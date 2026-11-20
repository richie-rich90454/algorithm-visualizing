/** write-through-cache.test.ts - Independent cache reference, memory consistency, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { access, type CacheState } from "./write-through-cache";
import type { VisualFrame } from "@/types";

type Op = { op: "read" | "write"; address: number; value?: number };

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
        expect(frame.meta).toBeDefined();
    });
}

describe("Write-Through Cache", () => {
    it("matches an independent direct-mapped reference", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const sets = 2 + (trial % 5);
            const addresses = Array.from({ length: 10 }, (_, i) => i);
            const ops: Op[] = Array.from({ length: 18 }, (_, i) => ({
                op: i % 3 === 0 ? "read" : "write",
                address: (trial + i * 3) % 10,
                value: 100 + i,
            }));
            const writeAllocate = trial % 2 === 0;
            let state: CacheState = {
                slots: Array.from({ length: sets }, () => ({ tag: -1, value: 0, valid: false })),
                memory: Object.fromEntries(addresses.map((a) => [a, a])),
            };
            for (const operation of ops) {
                const index = operation.address % sets;
                const tag = Math.floor(operation.address / sets);
                const slot = state.slots[index]!;
                const expectedHit = slot.valid && slot.tag === tag;
                const nextSlots = state.slots.map((s) => ({ ...s }));
                const nextMemory = { ...state.memory };
                if (operation.op === "write") {
                    nextMemory[operation.address] = operation.value!;
                    if (expectedHit || writeAllocate) {
                        nextSlots[index] = { tag, value: operation.value!, valid: true };
                    }
                } else if (!expectedHit) {
                    nextSlots[index] = { tag, value: nextMemory[operation.address] ?? 0, valid: true };
                }
                const expected = { slots: nextSlots, memory: nextMemory };
                const result = access(state, operation.address, operation.value ?? 0, operation.op === "write", sets, writeAllocate);
                expect(result.hit).toBe(expectedHit);
                expect(result.state.slots).toEqual(expected.slots);
                expect(result.state.memory).toEqual(expected.memory);
                state = result.state;
            }
        }
    });

    it("keeps memory equal to the last write at every address", () => {
        const sets = 3;
        const addresses = [0, 1, 2, 3, 4, 5];
        const ops: Op[] = [
            { op: "write", address: 2, value: 99 },
            { op: "read", address: 2 },
            { op: "write", address: 5, value: 50 },
            { op: "write", address: 2, value: 77 },
        ];
        const frames = [...mod.run({ sets, addresses, ops, writeAllocate: false })];
        const final = frames[frames.length - 1]!.meta["memory"] as number[];
        expect(final[2]).toBe(77);
        expect(final[5]).toBe(50);
        expect(frames[frames.length - 1]!.meta["memoryWrites"]).toBe(3);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["done"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
