import { describe, expect, it } from "vitest";
import greenHackenbushStalk from "./green-hackenbush-stalk";

describe("GreenHackenbushStalk", () => {
    it("yields at least one frame", () => {
        const generator = greenHackenbushStalk.run(greenHackenbushStalk.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = greenHackenbushStalk.run(greenHackenbushStalk.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
