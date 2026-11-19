/**
 * measurement-device-independent-qkd.test.ts - Bell parity, sifting,
 * noise extremes, determinism, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./measurement-device-independent-qkd";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]!.meta;
}

describe("MeasurementDeviceIndependentQkd", () => {
    it("announces the parity of the two bits in matching-basis rounds", () => {
        const frames = [...mod.run({ rounds: 12, seed: 4, noise: 0 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        const ab = meta["aliceBases"] as number[];
        const bb = meta["bobBases"] as number[];
        const abit = meta["aliceBits"] as number[];
        const bbit = meta["bobBits"] as number[];
        const parity = meta["parities"] as number[];
        for (let i = 0; i < ab.length; i += 1) {
            if (ab[i] === bb[i]) expect(parity[i]).toBe(abit[i]! ^ bbit[i]!);
        }
    });

    it("keeps only matching bases and reconstructs Alice's bit", () => {
        const frames = [...mod.run({ rounds: 16, seed: 9, noise: 0 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        const ab = meta["aliceBases"] as number[];
        const bb = meta["bobBases"] as number[];
        const expected = ab.filter((basis, i) => basis === bb[i]).length;
        expect(meta["sifted"]).toBe(expected);
        expect(meta["siftedBob"]).toEqual(meta["siftedAlice"]);
        expect(meta["qber"]).toBe(0);
    });

    it("reports full error under total noise and respects Bell probability", () => {
        const noisy = finalMeta([...mod.run({ rounds: 12, seed: 2, noise: 1 })]);
        expect(noisy["qber"]).toBe(1);

        const clean = finalMeta([...mod.run({ rounds: 12, seed: 2, noise: 0 })]);
        const phi = clean["seenPhi"] as number[];
        const psi = clean["seenPsi"] as number[];
        for (let i = 0; i < phi.length; i += 1) expect(phi[i]! + psi[i]!).toBeCloseTo(0.5, 9);
    });

    it("is deterministic and terminates cleanly", () => {
        const input = { rounds: 10, seed: 21, noise: 0.2 };
        const a = finalMeta([...mod.run(input)]);
        const b = finalMeta([...mod.run(input)]);
        expect(a["siftedBob"]).toEqual(b["siftedBob"]);
        expect(a["qber"]).toBe(b["qber"]);

        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
