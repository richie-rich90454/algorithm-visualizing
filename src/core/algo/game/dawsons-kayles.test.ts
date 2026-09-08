import { describe, expect, it } from "vitest";
import dawsonsKayles from "./dawsons-kayles";

describe("DawsonsKayles", () => {
    it("yields at least one frame", () => {
        const generator = dawsonsKayles.run(dawsonsKayles.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dawsonsKayles.run(dawsonsKayles.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
