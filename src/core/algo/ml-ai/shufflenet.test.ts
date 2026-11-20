/** shufflenet.test.ts - Brute-force reshape-transpose oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./shufflenet";
import type { VisualFrame } from "@/types";

interface Input {
    channels: number;
    groups: number;
}

function reference(input: Input) {
    const channels = input.channels;
    let groups = input.groups;
    groups = Math.max(1, Math.min(channels, groups));
    if (channels % groups !== 0) groups = 1;
    const perGroup = channels / groups;
    const flattened = Array.from(
        { length: channels },
        (_, c) => (c % perGroup) * groups + Math.floor(c / perGroup),
    );
    const inverse = new Array<number>(channels).fill(0);
    for (let c = 0; c < channels; c += 1) inverse[flattened[c] ?? 0] = c;
    return { groups, perGroup, flattened, inverse };
}

function checkFrames(frames: VisualFrame[], channels: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(channels);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ShuffleNet Channel Shuffle", () => {
    it("matches a brute-force reshape and transpose", () => {
        const cases: Input[] = [
            { channels: 8, groups: 2 },
            { channels: 12, groups: 3 },
            { channels: 16, groups: 4 },
            { channels: 9, groups: 2 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const expected = reference(input);
            checkFrames(frames, input.channels);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["groups"]).toBe(expected.groups);
            expect(meta?.["perGroup"]).toBe(expected.perGroup);
            expect(meta?.["permutation"]).toEqual(expected.flattened);
            expect(meta?.["inverse"]).toEqual(expected.inverse);
            expect(meta?.["bijective"]).toBe(true);
        }
    });

    it("produces a bijective permutation", () => {
        for (const input of [{ channels: 6, groups: 2 }, { channels: 10, groups: 5 }]) {
            const meta = [...mod.run(input)].at(-1)?.meta;
            const permutation = meta?.["permutation"] as number[];
            expect(new Set(permutation).size).toBe(input.channels);
            expect(Math.min(...permutation)).toBe(0);
            expect(Math.max(...permutation)).toBe(input.channels - 1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
