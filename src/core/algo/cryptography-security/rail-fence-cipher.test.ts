/** rail-fence-cipher.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./rail-fence-cipher";
import type { VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

function railAt(i: number, rails: number): number {
    const cycle = 2 * (rails - 1);
    if (cycle === 0) return 0;
    const offset = i % cycle;
    return offset < rails ? offset : cycle - offset;
}

/** Independent reference using the zigzag permutation. */
function reference(text: string, rails: number, mode: Mode): string {
    const sequence = [...text].map((_, i) => railAt(i, rails));
    if (mode === "encrypt") {
        const rows = Array.from({ length: rails }, () => "" as string);
        [...text].forEach((ch, i) => {
            rows[sequence[i] as number] += ch;
        });
        return rows.join("");
    }
    const lengths = Array.from({ length: rails }, (_, r) => sequence.filter((v) => v === r).length);
    const rows: string[] = [];
    let cursor = 0;
    for (let r = 0; r < rails; r += 1) {
        rows.push(text.slice(cursor, cursor + (lengths[r] as number)));
        cursor += lengths[r] as number;
    }
    const out: string[] = [];
    const used = new Array<number>(rails).fill(0);
    for (let i = 0; i < text.length; i += 1) {
        const r = sequence[i] as number;
        const index = used[r] as number;
        out.push((rows[r] as string)[index] ?? "");
        used[r] = index + 1;
    }
    return out.join("");
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
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

describe("Rail Fence Cipher", () => {
    it("matches the hand-worked HELLO example", () => {
        const cipher = outputOf({ text: "HELLO", rails: 3, mode: "encrypt" });
        expect(cipher).toBe("HOELL");
        expect(outputOf({ text: cipher, rails: 3, mode: "decrypt" })).toBe("HELLO");
    });

    it("matches an independent reference and round-trips for many rails", () => {
        const texts = [
            "WEAREDISCOVEREDFLEEONCE",
            "attackatdawn",
            "A B C D E F G H I J K L",
            "x",
            "aaaaaaaaaaaaaaaaaaaaaa",
        ];
        for (const text of texts) {
            const maxRails = Math.max(1, [...text].length);
            for (let rails = 1; rails <= Math.min(8, maxRails); rails += 1) {
                const frames = [...mod.run({ text, rails, mode: "encrypt" })];
                checkFrames(frames, rails * [...text].length);
                const cipher = outputOf({ text, rails, mode: "encrypt" });
                expect(cipher).toBe(reference(text, rails, "encrypt"));
                expect(cipher.length).toBe([...text].length);
                expect(outputOf({ text: cipher, rails, mode: "decrypt" })).toBe(text);
            }
        }
    });

    it("is a permutation of the plaintext letters", () => {
        const text = "THEQUICKBROWNFOX";
        const cipher = outputOf({ text, rails: 4, mode: "encrypt" });
        expect([...cipher].sort()).toEqual([...text].sort());
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
