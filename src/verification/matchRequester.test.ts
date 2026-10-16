import { describe, expect, it } from "vitest";
import { matchRequester } from "./matchRequester";

const sarah = { contactId: "s", displayName: "Sarah", relationship: "daughter" };
const daniel = { contactId: "d", displayName: "Daniel", relationship: "grandson" };
const tom = { contactId: "t", displayName: "Tom", relationship: "grandson" };

describe("matchRequester", () => {
  it.each([
    ["grandson", [sarah, daniel], daniel],
    ["my grandson Daniel", [sarah, daniel], daniel],
    ["Daniel H", [sarah, daniel], daniel],
    ["my grandchild", [sarah, daniel], daniel],
    ["your daughter", [sarah, daniel], sarah],
    ["Tom", [sarah, daniel, tom], tom],
  ])("matches %s", (name, circle, expected) => {
    expect(matchRequester(name, circle)).toEqual(expected);
  });
  it.each([
    ["grandson", [sarah, daniel, tom]],
    ["nephew", [sarah, daniel]],
    ["", [sarah, daniel]],
    ["my", [sarah]],
  ])("returns null for %s (ambiguous or unknown)", (name, circle) => {
    expect(matchRequester(name, circle)).toBeNull();
  });
});
