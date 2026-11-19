/**
 * proof-of-authority.test.ts - Signer-rotation property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateProofOfAuthority } from "./proof-of-authority";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], slots: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(slots);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proof of Authority", () => {
    it("matches an independent round-robin schedule for all signer strings", () => {
        const authorities = ["A", "B", "C"];
        const names = ["A", "B", "C", "X"];
        for (let slots = 1; slots <= 6; slots += 1) {
            for (let trial = 0; trial < 200; trial += 1) {
                const signers = Array.from({ length: slots }, (_, i) => names[(trial + i) % names.length] ?? "A");
                const data = simulateProofOfAuthority(authorities, signers);
                const expectedValid = signers.map((s, i) => s === (authorities[i % authorities.length] ?? "A"));
                const expectedAccepted = expectedValid.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
                expect(data.scheduled).toEqual(signers.map((_, i) => authorities[i % authorities.length]));
                expect(data.valid).toEqual(expectedValid);
                expect(data.accepted).toEqual(expectedAccepted);
            }
        }
    });

    it("accepts exactly the correctly signed slots in the default chain", () => {
        const input = { authorities: ["A", "B", "C"], signers: ["A", "B", "C", "A", "B", "A"] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 6);
        expect(frames[frames.length - 1]?.meta["acceptedSlots"]).toEqual([0, 1, 2, 3, 4]);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
