/**
 * argon2id.test.ts - Toy block recurrence check, frame shape, termination.
 * This verifies the toy model's exact math, not the security of real Argon2id.
 */

import { describe, expect, it } from "vitest";
import mod from "./argon2id";
import type { VisualFrame } from "@/types";

function rotl(value: number, bits: number): number {
    const shift = bits & 31;
    return shift === 0 ? value >>> 0 : ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function pseudoIndex(seed: number, index: number): number {
    return Math.floor(mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0)() * 4294967296) >>> 0;
}

function checkFrames(frames: VisualFrame[], expectedCount: number): void {
    expect(frames.length).toBe(expectedCount);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["dataDependent"]).toBe("boolean");
    });
}

describe("Argon2id toy model", () => {
    it("fills every block with the exact rotate-xor recurrence", () => {
        const input = { memoryBlocks: 16, seed: 5, passes: 1 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 1 + 15 + 1);
        const memory: number[][] = [];
        memory[0] = Array.from({ length: 4 }, (_, j) =>
            rotl((input.seed + j * 0x9e3779b9) >>> 0, 3 + 5 * j),
        );
        const initialWords = frames[0]?.meta["words"] as string[];
        expect(initialWords).toEqual(
            memory[0]!.map((value) => (value >>> 0).toString(16).padStart(8, "0")),
        );
        frames.slice(1, -1).forEach((frame, position) => {
            const i = position + 1;
            const previous = memory[i - 1]!;
            const slice = Math.floor((i * 4) / input.memoryBlocks);
            const dataDependent = slice >= 2;
            const reference = dataDependent
                ? previous[0]! % i
                : pseudoIndex(input.seed, i) % i;
            const refBlock = memory[reference]!;
            const expected = previous.map((_value, j) =>
                rotl(previous[(j + 1) % 4]! ^ refBlock[j]!, 5 + 3 * j),
            );
            memory[i] = expected;
            expect(frame.meta["reference"]).toBe(reference);
            expect(frame.meta["dataDependent"]).toBe(dataDependent);
            expect(frame.meta["slice"]).toBe(slice);
            const emitted = frame.meta["words"] as string[];
            for (let j = 0; j < 4; j += 1) {
                expect(emitted[j]).toBe((expected[j]! >>> 0).toString(16).padStart(8, "0"));
            }
        });
        const expectedTag = [0, 1, 2, 3]
            .map((j) => memory.reduce((acc, block) => acc ^ (block[j] ?? 0), 0) >>> 0)
            .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
            .join("");
        expect(frames[frames.length - 1]?.meta["tag"]).toBe(expectedTag);
    });

    it("alternates data-independent and data-dependent slices as specified", () => {
        const frames = [...mod.run({ memoryBlocks: 16, seed: 9, passes: 1 })];
        checkFrames(frames, 17);
        const modes = frames.slice(1, -1).map((frame) => frame.meta["dataDependent"]);
        expect(modes.slice(0, 7).every((m) => m === false)).toBe(true);
        expect(modes.slice(7).every((m) => m === true)).toBe(true);
    });

    it("is deterministic and handles multiple passes", () => {
        const input = { memoryBlocks: 8, seed: 3, passes: 2 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 1 + 7 * 2 + 1);
        expect(frames.map((f) => f.meta["words"])).toEqual(
            [...mod.run(input)].map((f) => f.meta["words"]),
        );
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
