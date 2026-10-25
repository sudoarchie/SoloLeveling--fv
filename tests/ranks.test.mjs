import test from "node:test"
import assert from "node:assert/strict"
import { RANKS, getRank, getNextRank, getRankProgressDetails } from "../lib/ranks.ts"

test("S-Rank requires 8.0 hours daily average (56.0 hours weekly)", () => {
  const sRank = RANKS.find((r) => r.name === "S")
  assert.ok(sRank, "S-Rank must exist")
  assert.equal(sRank.minDailyAvgHours, 8.0, "S-Rank must require 8.0 hours daily")
  assert.equal(sRank.minWeeklyHours, 56.0, "S-Rank must require 56.0 hours weekly")
})

test("Rank hierarchy smoothly scales up to S-Rank and beyond", () => {
  const rankDailyHours = Object.fromEntries(RANKS.map((r) => [r.name, r.minDailyAvgHours]))
  assert.equal(rankDailyHours["E"], 0)
  assert.equal(rankDailyHours["D"], 1.5)
  assert.equal(rankDailyHours["C"], 3.0)
  assert.equal(rankDailyHours["B"], 4.5)
  assert.equal(rankDailyHours["A"], 6.0)
  assert.equal(rankDailyHours["S"], 8.0)
  assert.equal(rankDailyHours["SS"], 10.0)
  assert.equal(rankDailyHours["SSS"], 12.0)
})

test("S-Rank is gated when user has sufficient EXP but insufficient weekly study hours", () => {
  const sRank = RANKS.find((r) => r.name === "S")
  const aRank = RANKS.find((r) => r.name === "A")

  // User has 8,000 EXP (enough for S-Rank EXP of 7,500), but only 45 hours (below 56.0h required)
  const rank = getRank(8000, 45.0)
  assert.equal(rank.name, "A", "User should hold A-Rank when weekly hours (45h) are below S-Rank requirement (56h)")

  // When user meets both 8,000 EXP and 56.0 hours, they achieve S-Rank
  const upgradedRank = getRank(8000, 56.0)
  assert.equal(upgradedRank.name, "S", "User achieves S-Rank when meeting 8h daily (56h/week) and EXP threshold")

  // Check progress details for someone with EXP but time-gated
  const progress = getRankProgressDetails(8000, 45.0, aRank, sRank)
  assert.equal(progress.isTimeGated, true, "Must flag as time-gated")
  assert.equal(progress.hoursNeeded, 11.0, "Must calculate exact hours needed (56 - 45 = 11h)")
})
