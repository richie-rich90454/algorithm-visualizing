/** columnar-transposition.test.ts - Reference grid, round-trip property, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./columnar-transposition";
import type { VisualFrame } from "@/types";

function encrypt(text: string, columns: number, padding: string): string {
    const chars = [...text];
    const rows = Math.ceil(chars.length / columns);
    const out: string[] = [];
    for (let c = 0; c < columns; c += 1) {
        for (let r = 0; r < rows; r += 1) out.push(chars[r * columns + c] ?? padding);
    }
    return out.join("");
}

function outputOf(frames: VisualFrame[]): string {
    return String(frames[frames.length - 1]?.meta["output"] ?? "");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("columnar-transposition", () => {
    it("matches an independent column-wise read", () => {
        const input = mod.defaultInput as { text: string; columns: number; padding: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(outputOf(frames)).toBe(encrypt(input.text, input.columns, input.padding));
    });

    it("round-trips every padding case", () => {
        const cases = [
            { text: "ATTACK", columns: 4 },
            { text: "ATTACKATDAWN", columns: 4 },
            { text: "A", columns: 3 },
            { text: "ABCDEFGHI", columns: 2 },
            { text: "", columns: 5 },
        ];
        for (const testCase of cases) {
            const cipher = outputOf([...mod.run({ ...testCase, mode: "encrypt", padding: "X" })]);
            const plain = outputOf([...mod.run({ text: cipher, columns: testCase.columns, mode: "decrypt", padding: "X" })]);
            expect(plain).toBe(testCase.text);
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
