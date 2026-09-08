import { describe, expect, it } from "vitest";
import optimalBst from "./optimal-bst";

describe("OptimalBst", () => {
    it("yields at least one frame", () => {
        const generator = optimalBst.run(optimalBst.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = optimalBst.run(optimalBst.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
