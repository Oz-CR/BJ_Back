import mongoose from "mongoose";

const cardsSchema = new mongoose.Schema({
  suit: String,
  rank: String,
  value: Number
}, { collection: "Cards" })

export const Cards = mongoose.model("Cards", cardsSchema)