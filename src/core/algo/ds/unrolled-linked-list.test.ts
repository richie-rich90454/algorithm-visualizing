/**
 * unrolled-linked-list.test.ts – Minimum viable test for Unrolled Linked List.
 */

import { describe, expect, it } from "vitest";
import unrolledLinkedList from "./unrolled-linked-list";

describe("UnrolledLinkedList", () => {
    it("yields at least one frame", () => {
        const generator = unrolledLinkedList.run(unrolledLinkedList.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = unrolledLinkedList.run(unrolledLinkedList.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
