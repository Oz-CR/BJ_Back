import mongoose from "mongoose";

const cardsSchema = new mongoose.Schema({
  suit: String,
  rank: String,
  value: Number
})

export const Cards = mongoose.model("Cards", cardsSchema)