/** bifid-cipher.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./bifid-cipher";
import type { VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";
type Coord = [number, number];

const SQUARE = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "K",
    "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U",
    "V", "W", "X", "Y", "Z",
];

function locate(ch: string): Coord | null {
    const normalized = ch === "J" ? "I" : ch;
    const index = SQUARE.indexOf(normalized);
    return index < 0 ? null : [Math.floor(index / 5), index % 5];
}

/** Independent reference Bifid cipher. */
function reference(text: string, period: number, mode: Mode): string {
    const chars = [...text.toUpperCase()];
    const indices = chars.map((ch, i) => (locate(ch) ? i : -1)).filter((i) => i >= 0);
    const output = chars.slice();
    for (let start = 0; start < indices.length; start += period) {
        const positions = indices.slice(start, start + period);
        const coords = positions.map((i) => locate(chars[i] as string) as Coord);
        let result: Coord[];
        if (mode === "encrypt") {
            const stream = [...coords.map((c) => c[0]), ...coords.map((c) => c[1])];
            result = [];
            for (let k = 0; k + 1 < stream.length; k += 2) {
                result.push([stream[k] as number, stream[k + 1] as number]);
            }
        } else {
            const stream: number[] = [];
            for (const [r, c] of coords) stream.push(r, c);
            const half = stream.length / 2;
            result = stream.slice(0, half).map((r, i) => [r, stream[half + i] as number] as Coord);
        }
        result.forEach(([r, c], k) => {
            output[positions[k] as number] = SQUARE[r * 5 + c] as string;
        });
    }
    return output.join("");
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedCells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedCells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const outputOf = (input: unknown): string => {
    const frames = [...mod.run(input)];
    return String(frames[frames.length - 1]?.meta["output"]);
};

describe("Bifid Cipher", () => {
    it("matches an independent reference for every period", () => {
        const text = "ATTACKATDAWN";
        for (let period = 2; period <= 8; period += 1) {
            const frames = [...mod.run({ text, period, mode: "encrypt" })];
            checkFrames(frames, 25);
            expect(outputOf({ text, period, mode: "encrypt" })).toBe(reference(text, period, "encrypt"));
        }
    });

    it("round-trips even period lengths", () => {
        const texts = [
            "ATTACKATDAWN",
            "THEQUICKBROWNFOX",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "MEET AT NOON 123",
            "JACK AND JILL",
        ];
        for (const text of texts) {
            for (const period of [2, 4, 6]) {
                const cipher = outputOf({ text, period, mode: "encrypt" });
                const plain = outputOf({ text: cipher, period, mode: "decrypt" });
                expect(plain.replaceAll("J", "I")).toBe(text.toUpperCase().replaceAll("J", "I"));
            }
        }
    });

    it("preserves non-letters and stays deterministic", () => {
        const text = "BIFID, 123! TEST";
        const cipher = outputOf({ text, period: 4, mode: "encrypt" });
        expect(cipher).toBe(reference(text, 4, "encrypt"));
        expect(cipher.replace(/[A-Z]/g, "")).toBe(text.replace(/[A-Z]/g, ""));
        expect(outputOf({ text, period: 4, mode: "encrypt" })).toBe(cipher);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
