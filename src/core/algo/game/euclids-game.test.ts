import { describe, expect, it } from "vitest";
import euclidsGame from "./euclids-game";

describe("EuclidsGame", () => {
    it("yields at least one frame", () => {
        const generator = euclidsGame.run(euclidsGame.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = euclidsGame.run(euclidsGame.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
