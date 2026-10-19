import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/lib/model.mjs";
function order(
  db,
  { qty = 10, bonus = 0, shopId = "s4", productId = "p1", rate = 180 } = {},
) {
  const next = M.createOrder(db, {
    shopId,
    lines: [{ productId, qty, bonus, rate, discount: 0 }],
  });
  return [next, next.orders[0].id];
}
test("approval reserves FEFO batch; full delivery posts one invoice and deducts stock", () => {
  let db = M.createSeed(),
    id;
  [db, id] = order(db);
  const originalStock = db.batches.find((b) => b.id === "b9").stock;
  db = M.approveOrder(db, id);
  const o = db.orders.find((x) => x.id === id);
  assert.equal(o.allocations[0].batchId, "b9");
  assert.equal(M.reserved(db, "b9"), 10);
  const before = db.invoices.length;
  db = M.deliverOrder(db, id);
  assert.equal(db.invoices.length, before + 1);
  assert.equal(M.reserved(db, "b9"), 0);
  assert.equal(db.batches.find((b) => b.id === "b9").stock, originalStock - 10);
  assert.equal(M.shopBalance(db, "s4"), 1800);
  assert.throws(() => M.deliverOrder(db, id), /Approve/);
});
test("stock is not oversold by competing approved orders", () => {
  let db = M.createSeed();
  db.shops.find((s) => s.id === "s4").limit = 10000000;
  let id;
  [db, id] = order(db, { qty: 1420 });
  db = M.approveOrder(db, id);
  let second;
  [db, second] = order(db, { qty: 20 });
  assert.throws(() => M.approveOrder(db, second), /Insufficient/);
  assert.equal(db.orders.find((o) => o.id === second).status, "Draft");
});
test("credit commitments prevent combined orders exceeding limit", () => {
  let db = M.createSeed();
  db.shops.find((s) => s.id === "s4").limit = 3000;
  let a, b;
  [db, a] = order(db, { qty: 10 });
  db = M.approveOrder(db, a);
  [db, b] = order(db, { qty: 10 });
  assert.throws(() => M.approveOrder(db, b), /credit limit/);
});
test("cancelling an approved order releases reserved quantities", () => {
  let db = M.createSeed(),
    id;
  [db, id] = order(db);
  db = M.approveOrder(db, id);
  assert.equal(M.reserved(db, "b9"), 10);
  db = M.cancelOrder(db, id);
  assert.equal(M.reserved(db, "b9"), 0);
  assert.equal(M.commitments(db, "s4"), 0);
});
test("expired and quarantine stock cannot be allocated", () => {
  let db = M.createSeed(),
    id;
  db.batches
    .filter((b) => b.productId === "p1")
    .forEach((b) => (b.expiry = M.addDays(db.today, -1)));
  [db, id] = order(db);
  assert.throws(() => M.approveOrder(db, id), /Insufficient/);
});
test("payment allocates oldest due invoice first and preserves overpayment", () => {
  let db = M.createSeed();
  db = M.recordPayment(db, {
    shopId: "s1",
    amount: 100000,
    date: db.today,
    method: "Cash",
    reference: "",
  });
  const receipt = db.payments[0];
  assert.equal(receipt.allocations[0].invoiceId, "INV-2026-001");
  assert.equal(receipt.allocations[0].amount, 25200);
  assert.equal(M.shopBalance(db, "s1"), -55000);
  assert.equal(
    receipt.amount - receipt.allocations.reduce((s, a) => s + a.amount, 0),
    55000,
  );
});
test("previous customer advance automatically applies to new delivery", () => {
  let db = M.createSeed();
  db = M.recordPayment(db, {
    shopId: "s4",
    amount: 1000,
    date: db.today,
    method: "Cash",
    reference: "",
  });
  let id;
  [db, id] = order(db);
  db = M.approveOrder(db, id);
  db = M.deliverOrder(db, id);
  const invoice = db.invoices[0];
  assert.equal(M.outstanding(db, invoice), 800);
  assert.equal(M.shopBalance(db, "s4"), 800);
});
test("paid invoice return creates customer credit and quarantines returned stock", () => {
  let db = M.createSeed();
  const before = M.shopBalance(db, "s3"),
    saleable = M.available(db, "p7");
  db = M.recordReturn(db, {
    invoiceId: "INV-2026-003",
    lineId: "il5",
    qty: 2,
    reason: "Damaged packaging",
  });
  assert.equal(M.shopBalance(db, "s3"), before - 1560);
  assert.equal(db.returns[0].total, 1560);
  assert.equal(M.available(db, "p7"), saleable);
  assert.equal(db.batches.at(-1).status, "Quarantine");
  assert.equal(db.batches.at(-1).stock, 2);
  assert.equal(
    M.outstanding(
      db,
      db.invoices.find((i) => i.id === "INV-2026-003"),
    ),
    0,
  );
});
test("cumulative returns cannot exceed delivered charged quantity", () => {
  let db = M.createSeed();
  db = M.recordReturn(db, {
    invoiceId: "INV-2026-003",
    lineId: "il5",
    qty: 59,
    reason: "Customer return",
  });
  assert.throws(
    () =>
      M.recordReturn(db, {
        invoiceId: "INV-2026-003",
        lineId: "il5",
        qty: 2,
        reason: "Customer return",
      }),
    /exceeds/,
  );
});
test("bonus stock is consumed but never charged", () => {
  let db = M.createSeed(),
    id;
  [db, id] = order(db, { qty: 10, bonus: 2 });
  db = M.approveOrder(db, id);
  assert.equal(M.reserved(db, "b9"), 12);
  db = M.deliverOrder(db, id);
  assert.equal(db.invoices[0].total, 1800);
  assert.equal(db.invoices[0].lines[0].bonus, 2);
});
test("blocked shop cannot create new supply but can make payments", () => {
  let db = M.createSeed();
  db = M.toggleShop(db, "s4");
  assert.throws(() => order(db), /active shop/);
  assert.doesNotThrow(() =>
    M.recordPayment(db, {
      shopId: "s4",
      amount: 100,
      date: db.today,
      method: "Cash",
      reference: "",
    }),
  );
});
test("invalid stock and financial input rejected without changing original", () => {
  const db = M.createSeed();
  assert.throws(
    () =>
      M.receiveStock(db, {
        supplierId: "sup1",
        productId: "p1",
        number: "A",
        expiry: M.addDays(db.today, 100),
        qty: -1,
        cost: 50,
      }),
    /Quantity/,
  );
  assert.throws(
    () =>
      M.recordPayment(db, {
        shopId: "s1",
        amount: NaN,
        date: db.today,
        method: "Cash",
        reference: "",
      }),
    /amount/,
  );
  assert.throws(
    () =>
      M.recordPayment(db, {
        shopId: "s1",
        amount: 100,
        date: db.today,
        method: "Bank transfer",
        reference: "",
      }),
    /reference/,
  );
  assert.equal(db.audit.length, 0);
});
test("receiving new batch preserves its cost and expiry", () => {
  const db = M.receiveStock(M.createSeed(), {
    supplierId: "sup1",
    productId: "p1",
    number: "NEW-26",
    expiry: "2030-01-01",
    qty: 50,
    cost: 125,
  });
  assert.equal(db.batches.at(-1).stock, 50);
  assert.equal(db.batches.at(-1).cost, 125);
  assert.equal(db.receivings[0].number, "NEW-26");
});
