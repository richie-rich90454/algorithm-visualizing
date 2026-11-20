/**
 * fasta-sequence-alignment.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./fasta-sequence-alignment";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout === "text" || frame.layout === "grid").toBe(true);
        expect(frame.entities.every((e) => e.type === (frame.layout === "text" ? "character" : "cell"))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FASTA Multiple Sequence Alignment", () => {
    it("produces a valid multiple alignment on the default input", () => {
        const input = mod.defaultInput as { sequences: string[]; k: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const alignment = finalMeta?.["alignment"] as string[];
        expect(Array.isArray(alignment)).toBe(true);
        expect(alignment.length).toBe(input.sequences.length);
        for (let i = 0; i < input.sequences.length; i += 1) {
            expect((alignment[i] ?? "").replace(/-/g, "")).toBe(input.sequences[i]);
        }
        const widths = new Set(alignment.map((row) => row.length));
        expect(widths.size).toBe(1);
    });

    it("preserves every input sequence on randomized inputs", () => {
        const alphabet = "ACGT";
        let seed = 41;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 40; t += 1) {
            const sequences = Array.from({ length: 2 + (rand() % 2) }, () =>
                Array.from({ length: 3 + (rand() % 6) }, () => alphabet[rand() % alphabet.length]).join(""),
            );
            const frames = [...mod.run({ sequences, k: 2 })];
            checkFrames(frames);
            const alignment = frames[frames.length - 1]?.meta["alignment"] as string[];
            expect(alignment.length).toBe(sequences.length);
            for (let i = 0; i < sequences.length; i += 1) {
                expect((alignment[i] ?? "").replace(/-/g, "")).toBe(sequences[i]);
            }
            expect(new Set(alignment.map((row) => row.length)).size).toBe(1);
        }
    });

    it("handles a single sequence and an empty list", () => {
        const single = [...mod.run({ sequences: ["ACGT"], k: 2 })];
        checkFrames(single);
        expect((single[single.length - 1]?.meta["alignment"] as string[])[0]).toBe("ACGT");

        const empty = [...mod.run({ sequences: [], k: 2 })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["sequences"]).toEqual([]);
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
