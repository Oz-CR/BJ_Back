import mongoose from "mongoose";

const gamesSchema = new mongoose.Schema({
  name: String,
  owner_id: Number,
  pack: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cards" }],
  is_active: Boolean,
  is_ended: Boolean,
  player_ids: [Number],
  turn: Number,
  winner_id: Number,
}, { collection: "Games" })

export const Games = mongoose.model("Games", gamesSchema)