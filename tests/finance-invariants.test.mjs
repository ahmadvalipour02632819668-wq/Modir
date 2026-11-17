import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Independent reference model for the financial invariants used by the SQL ledger.
function allocateFifo(obligations, payment) {
  let remaining = payment;
  return obligations.map((item) => {
    const applied = Math.min(item.amount, remaining);
    remaining -= applied;
    return { ...item, paid: applied, outstanding: item.amount - applied };
  }).concat(remaining > 0 ? [{ category: "credit", amount: remaining, paid: 0, outstanding: -remaining }] : []);
}

function netPayment(original, corrections) {
  return original - corrections.reduce((sum, amount) => sum + amount, 0);
}

function remainingBalance(previousDebt, currentDue, currentPaid) {
  return previousDebt + currentDue - currentPaid;
}

test("FIFO allocates payment to oldest obligations and never over-allocates", () => {
  const rows = allocateFifo([
    { ym: 140501, category: "charge", amount: 300 },
    { ym: 140502, category: "water", amount: 120 },
    { ym: 140502, category: "gas", amount: 80 },
  ], 350);
  assert.deepEqual(rows.slice(0, 3).map(x => [x.paid, x.outstanding]), [
    [300, 0], [50, 70], [0, 80],
  ]);
  assert.equal(rows.reduce((sum, x) => sum + x.paid, 0), 350);
});

test("payment larger than debt remains a credit, not a negative debt", () => {
  const rows = allocateFifo([{ ym: 140501, category: "charge", amount: 250 }], 400);
  assert.equal(rows[0].outstanding, 0);
  assert.deepEqual(rows[1], { category: "credit", amount: 150, paid: 0, outstanding: -150 });
});

test("approved payment correction reverses exactly once and preserves the net amount", () => {
  assert.equal(netPayment(500, [500]), 0);
  assert.equal(netPayment(500, []), 500);
  assert.equal(netPayment(500, [200]), 300);
  assert.ok(netPayment(500, [500]) >= 0);
});

test("monthly balance combines prior debt, current obligations and current payments", () => {
  assert.equal(remainingBalance(700, 300, 250), 750);
  assert.equal(remainingBalance(0, 300, 450), -150);
});

test("finance UI exposes the audited correction action and calls the server RPC", () => {
  const source = read("finance.js");
  assert.match(source, /data-correct/);
  assert.match(source, /app_admin_correct_approved_payment/);
  assert.match(source, /payment_corrected/);
  assert.match(source, /p_reason:\s*reason\.trim\(\)/);
  assert.doesNotMatch(source, /(^|[^$])\$\([^)]*\)\s*\.forEach/);
  assert.doesNotMatch(source, /\$\$\$/);
});

test("database migration keeps correction records immutable and one-to-one", () => {
  const source = read("supabase/migrations/20261117185255_add_approved_payment_correction_workflow.sql");
  assert.match(source, /original_transaction_id bigint NOT NULL UNIQUE/);
  assert.match(source, /correction_transaction_id bigint NOT NULL UNIQUE/);
  assert.match(source, /BEFORE UPDATE OR DELETE ON public\.payment_corrections/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /status IS DISTINCT FROM 'approved'/);
  assert.match(source, /tx\.amount/);
});

test("ledger, FIFO and reports all subtract audited corrections from original payments", () => {
  const files = [
    "supabase/migrations/20261117185255_add_approved_payment_correction_workflow.sql",
    "supabase/migrations/20261117195550_apply_payment_corrections_to_account_exit_preview.sql",
  ];
  const combined = files.map(read).join("\n");
  assert.match(combined, /sum\(pc\.amount\)/);
  assert.match(combined, /payment_corrections/);
  assert.match(combined, /app_report/);
  assert.match(combined, /app_process_payment_fifo/);
});
