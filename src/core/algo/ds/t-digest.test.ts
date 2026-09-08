import { describe, expect, it } from "vitest";
import mod from "./t-digest";

describe("T-Digest", () => {
    it("yields at least one frame", () => {
        const g = mod.run(mod.defaultInput);
        const first = g.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const g = mod.run(mod.defaultInput);
        let frames = 0;
        for (const frame of g) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
