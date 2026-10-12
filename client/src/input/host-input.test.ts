import type { InputMessage } from "@overgrown/sim/protocol";
import { describe, expect, it } from "vitest";
import { HostInput, NO_HELD_INPUT, type HeldInput } from "./host-input";

function setup(initial: "keyboard-mouse" | "touch" = "keyboard-mouse") {
  const posts: InputMessage[] = [];
  return { posts, host: new HostInput((m) => posts.push(m), initial) };
}
const held = (over: Partial<HeldInput>): HeldInput => ({ ...NO_HELD_INPUT, ...over });

describe("HostInput", () => {
  it("presses from every source advance one shared u32 counter per button", () => {
    const { host, posts } = setup();
    host.press("keyboard-mouse", "attack", NO_HELD_INPUT);
    host.press("touch", "attack", NO_HELD_INPUT);
    host.press("touch", "dodge", NO_HELD_INPUT);
    host.press("keyboard-mouse", "dodge", NO_HELD_INPUT);
    expect(posts.map((m) => m.attackPresses)).toEqual([1, 2, 2, 2]);
    expect(posts.map((m) => m.dodgePresses)).toEqual([0, 0, 1, 2]);
    expect(posts).toHaveLength(4);
  });

  it("held fields come from the source with the latest user activity; a switch never changes a counter", () => {
    const { host, posts } = setup();
    host.press("keyboard-mouse", "attack", NO_HELD_INPUT);
    host.press("keyboard-mouse", "dodge", NO_HELD_INPUT);
    posts.length = 0;
    const counters = { attackPresses: 1, dodgePresses: 1 };

    host.report("touch", held({ moveX: 1 }), true);
    expect(host.active).toBe("touch");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ moveX: 1, ...counters });

    host.report("keyboard-mouse", held({ aimX: 5 }), false);
    expect(posts).toHaveLength(1);
    expect(host.active).toBe("touch");

    host.report("keyboard-mouse", held({ aimX: 5 }), true);
    expect(posts).toHaveLength(2);
    expect(posts[1]).toMatchObject({ moveX: 0, aimX: 5, ...counters });

    host.report("keyboard-mouse", held({ aimX: 5 }), true);
    expect(posts).toHaveLength(2);

    host.report("touch", held({ moveX: 1 }), true);
    expect(posts).toHaveLength(3);
    expect(posts[2]).toMatchObject({ moveX: 1, aimX: 0, ...counters });
  });

  it("a press and its held state are one message", () => {
    const { host, posts } = setup("touch");
    host.press("touch", "attack", held({ aimX: 30, aimY: -4 }));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ aimX: 30, aimY: -4, attackPresses: 1, dodgePresses: 0 });
  });
});
