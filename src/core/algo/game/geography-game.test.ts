import { describe, expect, it } from "vitest";
import geographyGame from "./geography-game";

describe("GeographyGame", () => {
    it("yields at least one frame", () => {
        const generator = geographyGame.run(geographyGame.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = geographyGame.run(geographyGame.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
