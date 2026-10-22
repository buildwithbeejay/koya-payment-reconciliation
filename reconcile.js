
const fs = require("node:fs");
const path = require("node:path");

const dataPath = path.join(__dirname, "payments.jsonl");
const expectedPath = path.join(__dirname, "expected.txt");

const latestByTxn = new Map();
const lines = fs.readFileSync(dataPath, "utf8").split(/\r?\n/);

for (const line of lines) {
  if (!line.trim()) continue;

  let event;

  try {
    event = JSON.parse(line);
  } catch {
    // Ignore unreadable JSON lines.
    continue;
  }

  if (!event || !event.txn_id) {
    // Events without a transaction ID cannot be reconciled.
    continue;
  }

  const timestamp = Date.parse(event.ts);

  const previous = latestByTxn.get(event.txn_id);

  // When timestamps tie, the later event in the file wins.
  if (!previous || timestamp >= previous.timestamp) {
    latestByTxn.set(event.txn_id, { timestamp, event });
  }
}

let count = 0;
let totalCents = 0;

for (const { event } of latestByTxn.values()) {
  if (event.status !== "success") continue;

  // Handle amounts such as "3,218.81" without floating-point
  // accumulation errors when adding payment totals.
  const amount = Number(String(event.amount).replace(/,/g, ""));

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount for transaction ${event.txn_id}`);
  }

  totalCents += Math.round(amount * 100);
  count++;
}

const expected = Number(
  fs.readFileSync(expectedPath, "utf8").trim()
);

if (count !== expected) {
  console.log(
    `Check failed: counted ${count} successful payments, expected ${expected}.`
  );
  process.exitCode = 1;
} else {
  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Your code: KOYA-${Math.floor(totalCents / 100 + 0.5)}`);
}
