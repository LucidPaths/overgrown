import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/actor-anims.json";
import { ACTOR_ANIMS } from "./actor-anims";

// tools/art/tests/test_actor.py asserts the pipeline's frames against the same file.
describe("actor animation frame counts", () => {
  it("equal the shared fixture", () => {
    const counts = Object.fromEntries(Object.entries(ACTOR_ANIMS).map(([k, v]) => [k, v.frames]));
    expect(counts).toEqual(fixture.frames);
  });
});
