/**
 * xor-parity-raid.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./xor-parity-raid";
import type { VisualFrame } from "@/types";

function reference(dataDisks: number[][], failedDisk: number) {
    const width = Math.min(...dataDisks.map((disk) => disk.length));
    const parity: number[] = [];
    for (let col = 0; col < width; col += 1) {
        let value = 0;
        for (const disk of dataDisks) value ^= disk[col] ?? 0;
        parity.push(value);
    }
    const reconstructed = parity.map((parityValue, col) => {
        let value = parityValue;
        for (let d = 0; d < dataDisks.length; d += 1) {
            if (d !== failedDisk) value ^= dataDisks[d]?.[col] ?? 0;
        }
        return value;
    });
    return { parity, reconstructed, original: dataDisks[failedDisk]?.slice(0, width) ?? [] };
}

function checkFrames(frames: VisualFrame[], diskCount: number, width: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        const parityLength = (frame.meta["parity"] as number[]).length;
        expect(frame.entities.length).toBe(diskCount * width + parityLength);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("XOR parity RAID", () => {
    it("reconstructs every possible failed disk from the computed parity", () => {
        const dataDisks = [
            [0x2a, 0x4f, 0x11, 0x9c],
            [0x13, 0x20, 0x76, 0x05],
            [0x67, 0x0d, 0x38, 0xa1],
        ];
        for (let failed = 0; failed < dataDisks.length; failed += 1) {
            const frames = [...mod.run({ dataDisks, failedDisk: failed })] as VisualFrame[];
            checkFrames(frames, dataDisks.length, 4);
            const expected = reference(dataDisks, failed);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["parity"]).toEqual(expected.parity);
            expect(finalMeta?.["reconstructed"]).toEqual(expected.reconstructed);
            expect(finalMeta?.["reconstructed"]).toEqual(expected.original);
            expect(finalMeta?.["match"]).toBe(true);
        }
    });

    it("verifies the XOR identity directly on the default input", () => {
        const input = mod.defaultInput as { dataDisks: number[][]; failedDisk: number };
        const frames = [...mod.run(input)];
        const finalMeta = frames[frames.length - 1]?.meta;
        const parity = finalMeta?.["parity"] as number[];
        const width = input.dataDisks[0]?.length ?? 0;
        for (let col = 0; col < width; col += 1) {
            const all = input.dataDisks.reduce((value, disk) => value ^ (disk[col] ?? 0), 0);
            expect(parity[col]).toBe(all);
            const rebuilt = (finalMeta?.["reconstructed"] as number[])[col];
            expect(rebuilt ^ (input.dataDisks[input.failedDisk]?.[col] ?? 0)).toBe(0);
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
