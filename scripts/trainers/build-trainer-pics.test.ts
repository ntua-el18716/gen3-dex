import { describe, expect, it } from "vitest";

import {
  parseGraphicsPaths,
  parsePicTable,
  parseTrainerPics,
  symbolFromConstant,
} from "./build-trainer-pics";

describe("trainer picture lookups", () => {
  it("reads each trainer's picture constant", () => {
    const source = `
    [TRAINER_ROXANNE_1] =
    {
        .trainerClass = TRAINER_CLASS_LEADER,
        .trainerPic = TRAINER_PIC_LEADER_ROXANNE,
        .items = {ITEM_POTION, ITEM_NONE},
        .party = TRAINER_PARTY(sParty_Roxanne1),
    },
    [TRAINER_LEADER_BROCK] = {
        .trainerPic = TRAINER_PIC_LEADER_BROCK,
    },`;
    expect([...parseTrainerPics(source)]).toEqual([
      ["TRAINER_ROXANNE_1", "TRAINER_PIC_LEADER_ROXANNE"],
      ["TRAINER_LEADER_BROCK", "TRAINER_PIC_LEADER_BROCK"],
    ]);
  });

  it("reads the picture table", () => {
    const table = `
    TRAINER_SPRITE(LEADER_ROXANNE, gTrainerFrontPic_LeaderRoxanne, TRAINER_PIC_SIZE),
    TRAINER_SPRITE(LEADER_BROCK, gTrainerFrontPic_LeaderBrock, 0x800),`;
    expect(parsePicTable(table).get("TRAINER_PIC_LEADER_BROCK")).toBe(
      "gTrainerFrontPic_LeaderBrock",
    );
  });

  it("names pokeruby's symbols after the constant", () => {
    expect(symbolFromConstant("TRAINER_PIC_ROXANNE")).toBe(
      "gTrainerFrontPic_Roxanne",
    );
    expect(symbolFromConstant("TRAINER_PIC_TATE_AND_LIZA")).toBe(
      "gTrainerFrontPic_TateAndLiza",
    );
  });

  it("finds the PNG behind each graphics symbol", () => {
    const graphics = `
const u32 gTrainerFrontPic_LeaderRoxanne[] = INCGFX_U32("graphics/trainers/front_pics/leader_roxanne.png", ".4bpp.lz");
const u32 gTrainerFrontPic_LeaderBrock[] = INCBIN_U32("graphics/trainers/front_pics/leader_brock_front_pic.4bpp.lz");
const u8 gTrainerFrontPic_Roxanne[] = INCBIN_U8("graphics/trainers/roxanne.4bpp.lz");
const u8 gTrainerPalette_Roxanne[] = INCBIN_U8("graphics/trainers/roxanne.gbapal.lz");`;
    expect([...parseGraphicsPaths(graphics)]).toEqual([
      [
        "gTrainerFrontPic_LeaderRoxanne",
        "graphics/trainers/front_pics/leader_roxanne.png",
      ],
      [
        "gTrainerFrontPic_LeaderBrock",
        "graphics/trainers/front_pics/leader_brock_front_pic.png",
      ],
      ["gTrainerFrontPic_Roxanne", "graphics/trainers/roxanne.png"],
    ]);
  });
});
