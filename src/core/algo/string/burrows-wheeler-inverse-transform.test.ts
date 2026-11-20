/**
 * burrows-wheeler-inverse-transform.test.ts - Round trips against an
 * independent forward BWT, permutation property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./burrows-wheeler-inverse-transform";
import type { VisualFrame } from "@/types";

function forward(text: string): string {
    const t = text.endsWith("$") ? text : `${text}$`;
    const n = t.length;
    const rows = Array.from({ length: n }, (_, i) => t.slice(i) + t.slice(0, i));
    rows.sort();
    return rows.map((r) => r[r.length - 1] ?? "").join("");
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[frames.length - 1].entities.every((e) => e.state === "sorted")).toBe(true);
}

describe("BurrowsWheelerInverseTransform", () => {
    it("round trips several strings through an independent forward transform", () => {
        for (const text of ["aba$", "banana$", "mississippi$", "aaaa$", "abacaba$", "cabd$"]) {
            const lastColumn = forward(text);
            const frames = [...mod.run({ bwt: lastColumn })];
            checkFrames(frames, text.length);
            expect(frames[frames.length - 1].meta["recovered"]).toBe(text);
        }
    });

    it("also accepts a text input and uses the sentinel convention", () => {
        expect([...mod.run({ text: "banana" })].at(-1)?.meta["recovered"]).toBe("banana$");
        expect([...mod.run({ text: "aba$" })].at(-1)?.meta["recovered"]).toBe("aba$");
    });

    it("keeps the first column sorted", () => {
        const frames = [...mod.run({ text: "cab$" })];
        const f = String(frames[1].meta["f"]);
        expect([...f]).toEqual([...f].sort());
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(2 + 7 + 1);
        expect(generator.next().done).toBe(true);
    });
});
