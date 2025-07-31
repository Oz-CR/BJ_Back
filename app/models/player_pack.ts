import mongoose from "mongoose";

const playerPacksSchema = new mongoose.Schema({
  player_id: Number,
  game_id: { type: mongoose.Schema.Types.ObjectId, ref: "Games" },
  pack: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cards" }],
  count: { type: Number, default: 0 },
  total_value: { type: Number, default: 0 },
  is_ready: Boolean
})

export const PlayerPacks = mongoose.model("PlayerPacks", playerPacksSchema)