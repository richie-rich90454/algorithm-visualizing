/**
 * singly-linked-list.test.ts – Minimum viable test for Singly Linked List.
 */

import { describe, expect, it } from "vitest";
import singlyLinkedList from "./singly-linked-list";

describe("SinglyLinkedList", () => {
    it("yields at least one frame", () => {
        const generator = singlyLinkedList.run(singlyLinkedList.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = singlyLinkedList.run(singlyLinkedList.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
