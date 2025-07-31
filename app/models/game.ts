import mongoose from "mongoose";

const gamesSchema = new mongoose.Schema({
  owner_id: Number,
  pack: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cards" }],
  is_active: Boolean,
  player_ids: [Number],
  turn: Number,
  winner: Number,
  game_code: String,
  is_ended: Boolean
})

export const Games = mongoose.model("Games", gamesSchema)