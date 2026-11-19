/**
 * damm-checksum.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./damm-checksum";
import type { VisualFrame } from "@/types";

const OP = [
    [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
    [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
    [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
    [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
    [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
    [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
    [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
    [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
    [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
    [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

function checkDigit(data: string): number {
    let interim = 0;
    for (const ch of data) {
        interim = (OP[interim] ?? [])[Number(ch)] ?? 0;
    }
    return interim;
}

function valid(code: string): boolean {
    let interim = 0;
    for (const ch of code) {
        interim = (OP[interim] ?? [])[Number(ch)] ?? 0;
    }
    return interim === 0;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(String(frame.meta["digits"]).length);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Damm Check Digit", () => {
    it("matches the published example and validates it", () => {
        const frames = [...mod.run({ digits: "572" })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["checkDigit"])).toBe(4);
        expect(final?.["valid"]).toBe(true);
        expect(checkDigit("572")).toBe(4);
        expect(valid("5724")).toBe(true);
    });

    it("is a quasigroup with a zero diagonal", () => {
        for (let row = 0; row < 10; row += 1) {
            expect([...(OP[row] ?? [])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            expect(OP[row]?.[row]).toBe(0);
            const column = OP.map((r) => r[row]).sort((a, b) => (a ?? 0) - (b ?? 0));
            expect(column).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
    });

    it("detects every single-digit error and adjacent transposition", () => {
        const base = "12345";
        const full = base + String(checkDigit(base));
        expect(valid(full)).toBe(true);
        for (let position = 0; position < full.length; position += 1) {
            for (let digit = 0; digit <= 9; digit += 1) {
                if (digit === Number(full[position])) {
                    continue;
                }
                const mutated = full.slice(0, position) + String(digit) + full.slice(position + 1);
                expect(valid(mutated)).toBe(false);
            }
        }
        for (let position = 0; position + 1 < full.length; position += 1) {
            if (full[position] === full[position + 1]) {
                continue;
            }
            const swapped =
                full.slice(0, position) + full[position + 1] + full[position] + full.slice(position + 2);
            expect(valid(swapped)).toBe(false);
        }
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
