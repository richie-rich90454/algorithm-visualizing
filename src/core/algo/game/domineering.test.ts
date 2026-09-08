import { describe, expect, it } from "vitest";
import domineering from "./domineering";

describe("Domineering", () => {
    it("yields at least one frame", () => {
        const generator = domineering.run(domineering.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = domineering.run(domineering.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
