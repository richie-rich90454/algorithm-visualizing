/**
 * fft-cooley-tukey.test.ts – Minimum viable test for FFT.
 */

import { describe, expect, it } from "vitest";
import fftCooleyTukey from "./fft-cooley-tukey";

describe("FftCooleyTukey", () => {
    it("yields at least one frame", () => {
        const generator = fftCooleyTukey.run(fftCooleyTukey.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = fftCooleyTukey.run(fftCooleyTukey.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
