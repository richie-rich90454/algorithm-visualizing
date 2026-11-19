/**
 * enhanced-clock-page-replacement.ts - Enhanced Second-Chance CLOCK
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Enhanced CLOCK extends the one-bit clock by tracking both a reference bit
 * and a modified bit, giving four eviction classes. On a miss the hand sweeps,
 * clearing reference bits as it goes, and evicts the first page in the lowest
 * class it can find: unreferenced and unmodified first, referenced and
 * modified last. This avoids writing a dirty page when a clean victim exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(capacity) per access in the worst case
 *   Space: O(capacity) for the frame table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero is the request stream; row one is the circular frame table.
 *   - Each frame cell shows its page and its reference and modified bits.
 *   - meta carries the hand position, eviction class, and hit/fault counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ClockInput {
    capacity?: number;
    requests?: number[];
    writes?: number[];
}

interface Frame {
    page: number;
    referenced: number;
    modified: number;
}

const DEFAULT_REQUESTS = [1, 2, 3, 4, 1, 5, 2, 6, 3, 7, 1, 4];

/** 0 is the best victim, 3 is the worst. */
const evictionClass = (frame: Frame): number => frame.referenced * 2 + frame.modified;

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ClockInput | null) ?? {};
    const capacity = Math.max(1, typeof task.capacity === "number" ? Math.floor(task.capacity) : 4);
    const requests = Array.isArray(task.requests) && task.requests.length > 0 ? task.requests.map(Number) : DEFAULT_REQUESTS;
    const writes = new Set(task.writes ?? []);
    const frames: Array<Frame | null> = new Array<Frame | null>(capacity).fill(null);
    let hand = 0;
    let hits = 0;
    let faults = 0;
    let step = 0;
    const cols = Math.max(requests.length, capacity);
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hand, hits, faults, ...meta },
    });
    const entitiesFor = (current: number, victim: number | null): VisualEntity[] => [
        ...requests.map((page, i) => cell(`r-${i}`, 0, i, String(page), page, i === current ? "active" : i < current ? "visited" : "idle")),
        ...frames.map((frame, i) =>
            cell(
                `f-${i}`,
                1,
                i,
                frame ? `${frame.page}[${frame.referenced}${frame.modified}]` : "-",
                frame ? `${frame.page}[${frame.referenced}${frame.modified}]` : "-",
                i === victim ? "error" : i === hand ? "comparing" : frame ? "visited" : "idle",
            ),
        ),
    ];

    yield emit(entitiesFor(-1, null), `Enhanced CLOCK with ${capacity} frame(s); all reference and modified bits clear.`, 0, {
        stage: "init",
        frames: [],
        requests: [...requests],
    });

    for (let i = 0; i < requests.length; i += 1) {
        const page = requests[i] as number;
        const slot = frames.findIndex((frame) => frame?.page === page);
        if (slot >= 0) {
            const frame = frames[slot] as Frame;
            frame.referenced = 1;
            if (writes.has(page)) frame.modified = 1;
            hits += 1;
            yield emit(entitiesFor(i, null), `Hit on page ${page} at frame ${slot}: set its reference bit.`, 1, {
                stage: "hit",
                page,
                slot,
                frames: frames.map((f) => (f ? `${f.page}:${f.referenced}${f.modified}` : "-")),
            });
            continue;
        }

        faults += 1;
        let free = frames.findIndex((frame) => frame === null);
        let victim = -1;
        let victimClass = 4;
        if (free >= 0) {
            victim = free;
        } else {
            let scanned = 0;
            while (scanned < 2 * capacity) {
                const frame = frames[hand] as Frame;
                const cls = evictionClass(frame);
                if (cls < victimClass) {
                    victimClass = cls;
                    victim = hand;
                }
                if (frame.referenced === 1) frame.referenced = 0;
                hand = (hand + 1) % capacity;
                scanned += 1;
                if (victimClass === 0) break;
            }
        }
        const oldClass = victimClass === 4 ? 0 : victimClass;
        frames[victim] = { page, referenced: 1, modified: writes.has(page) ? 1 : 0 };
        hand = (victim + 1) % capacity;
        yield emit(entitiesFor(i, victim), `Miss on page ${page}: evicted frame ${victim} from class ${oldClass} and installed the new page.`, 2, {
            stage: "fault",
            page,
            victim,
            victimClass: oldClass,
            frames: frames.map((f) => (f ? `${f.page}:${f.referenced}${f.modified}` : "-")),
        });
    }

    yield emit(
        entitiesFor(requests.length, null),
        `Done: ${hits} hit(s), ${faults} fault(s); final frames shown with their reference and modified bits.`,
        3,
        {
            stage: "done",
            hits,
            faults,
            frames: frames.map((f) => (f ? `${f.page}:${f.referenced}${f.modified}` : "-")),
        },
    );
}

/** The enhanced second-chance CLOCK module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A page that has been modified is more expensive to evict than a clean one, because a dirty page must be written back to disk. Enhanced CLOCK keeps a reference bit and a modified bit per frame, forming four classes from best to worst victim. The hand clears reference bits as it sweeps and stops at the lowest class it finds, so clean cold pages go first.",
        invariants: [
            "Every resident page has a reference bit and a modified bit of zero or one.",
            "A hit always sets the reference bit of the resident page.",
            "The hand always advances modulo the capacity.",
        ],
        correctness:
            "During an eviction the hand inspects at least two full revolutions when no clean unreferenced page exists. Any referenced frame seen during the scan has its bit cleared, so after one revolution every candidate belongs to a lower or equal class than before. Choosing the first frame of the minimum class encountered therefore selects the cheapest valid victim: class zero when one exists, otherwise the best available class. Installing the new page with a set reference bit guarantees it receives a second chance before eviction.",
        complexityRationale:
            "A hit is constant time. A miss sweeps at most two capacity-length revolutions, so each access costs O(capacity) time and the frame table uses O(capacity) space.",
        uses: [
            "Operating-system virtual memory page replacement",
            "Buffer-pool eviction in database management systems",
            "Second-level caches that distinguish dirty from clean entries",
        ],
        references: [
            "Carr and Hennessy, A Second Chance Page Replacement Algorithm, 1981",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter on memory management",
        ],
        workedExample:
            "With four frames full and classes (page1 = 11, page2 = 10, page3 = 01, page4 = 00), a miss scans and evicts page4 first because it is unreferenced and unmodified. If every page is referenced, the first sweep clears all reference bits and the second sweep finds a class-zero victim.",
    },
    id: "enhanced-clock-page-replacement",
    name: "Enhanced Second-Chance CLOCK Page Replacement",
    category: "production-systems",
    complexity: { time: "O(capacity)", space: "O(capacity)" },
    defaultInput: { capacity: 4, requests: DEFAULT_REQUESTS },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty frames and a clock hand at zero",
        "for each requested page",
        "if resident, set its reference bit and continue",
        "otherwise choose a victim by sweeping the hand",
        "clear reference bits passed during the sweep",
        "evict the lowest-class frame and install the new page",
        "done: report hits, faults, and final frame bits",
    ],
};

export default module;
