export const STORAGE_KEY = "pharmaflow-demo-v1";
export const dateISO = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function addDays(value, days) {
  const d = new Date(value + "T12:00:00");
  d.setDate(d.getDate() + days);
  return dateISO(d);
}
export const daysBetween = (from, to) =>
  Math.round(
    (new Date(to + "T12:00:00") - new Date(from + "T12:00:00")) / 86400000,
  );
export const money = (n) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n || 0);
export const numeric = (n) => Number(n) || 0;
export const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const uid = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2)}`;
export const lineTotal = (line) =>
  typeof line.total === "number"
    ? line.total
    : round(line.qty * line.rate * (1 - (line.discount || 0) / 100));
export const totalLines = (lines) =>
  round(lines.reduce((sum, l) => sum + lineTotal(l), 0));
export function paidAmount(db, id) {
  return round(
    db.payments.reduce(
      (s, p) =>
        s +
        p.allocations
          .filter((a) => a.invoiceId === id)
          .reduce((a, x) => a + x.amount, 0),
      0,
    ),
  );
}
export function creditedAmount(db, id) {
  return round(
    db.returns
      .filter((r) => r.invoiceId === id)
      .reduce((s, r) => s + r.total, 0),
  );
}
export function outstanding(db, invoice) {
  return Math.max(
    0,
    round(
      invoice.total -
        creditedAmount(db, invoice.id) -
        paidAmount(db, invoice.id),
    ),
  );
}
export function shopBalance(db, id) {
  return round(
    db.invoices
      .filter((i) => i.shopId === id)
      .reduce((s, i) => s + i.total, 0) -
      db.returns
        .filter((r) => r.shopId === id)
        .reduce((s, r) => s + r.total, 0) -
      db.payments
        .filter((p) => p.shopId === id)
        .reduce((s, p) => s + p.amount, 0),
  );
}
export function commitments(db, id, exclude) {
  return db.orders
    .filter(
      (o) => o.shopId === id && o.status === "Approved" && o.id !== exclude,
    )
    .reduce((s, o) => s + o.total, 0);
}
export const invoiceStatus = (db, i) =>
  outstanding(db, i) === 0
    ? "Settled"
    : paidAmount(db, i) > 0 || creditedAmount(db, i) > 0
      ? "Partially paid"
      : "Unpaid";
export function reserved(db, batchId) {
  return db.orders
    .filter((o) => o.status === "Approved")
    .flatMap((o) => o.allocations || [])
    .filter((a) => a.batchId === batchId)
    .reduce((s, a) => s + a.qty, 0);
}
export function eligible(batch, day) {
  return batch.status === "Saleable" && batch.expiry > day;
}
export function available(db, productId, day = db.today) {
  return db.batches
    .filter((b) => b.productId === productId && eligible(b, day))
    .reduce((s, b) => s + Math.max(0, b.stock - reserved(db, b.id)), 0);
}
export function createSeed() {
  const today = dateISO(),
    d = (n) => addDays(today, n);
  const products = [
    [
      "p1",
      "Paracetamol",
      "500 mg",
      "Tablet",
      "GSK",
      "Analgesics",
      180,
      120,
      10,
    ],
    [
      "p2",
      "Amoxicillin",
      "500 mg",
      "Capsule",
      "Getz Pharma",
      "Antibiotics",
      680,
      40,
      10,
    ],
    [
      "p3",
      "Cetirizine",
      "10 mg",
      "Tablet",
      "Highnoon",
      "Antihistamines",
      240,
      60,
      10,
    ],
    [
      "p4",
      "Omeprazole",
      "20 mg",
      "Capsule",
      "Searle",
      "Gastrointestinal",
      420,
      50,
      14,
    ],
    ["p5", "ORS sachets", "20.5 g", "Sachet", "Abbott", "Hydration", 85, 80, 1],
    [
      "p6",
      "Vitamin C",
      "500 mg",
      "Tablet",
      "Martin Dow",
      "Supplements",
      320,
      40,
      20,
    ],
    [
      "p7",
      "Azithromycin",
      "250 mg",
      "Capsule",
      "Sami",
      "Antibiotics",
      780,
      30,
      6,
    ],
    [
      "p8",
      "Metformin",
      "500 mg",
      "Tablet",
      "Hilton Pharma",
      "Metabolic",
      260,
      70,
      10,
    ],
  ].map(
    ([
      id,
      name,
      strength,
      form,
      manufacturer,
      category,
      price,
      reorder,
      pack,
    ]) => ({
      id,
      name,
      strength,
      form,
      manufacturer,
      category,
      price,
      reorder,
      pack,
      unit: "pack",
    }),
  );
  const shops = [
    [
      "s1",
      "Al Shifa Pharmacy",
      "Ahmed Khan",
      "03001234567",
      "Kohat",
      "Main Bazaar",
      100000,
      30,
      "AK",
    ],
    [
      "s2",
      "City Medical Store",
      "Usman Ali",
      "03339876543",
      "Peshawar",
      "University Road",
      80000,
      21,
      "CM",
    ],
    [
      "s3",
      "Care Plus Pharmacy",
      "Sana Malik",
      "03115556677",
      "Kohat",
      "Hospital Road",
      120000,
      30,
      "CP",
    ],
    [
      "s4",
      "Noor Medical Store",
      "Bilal Shah",
      "03452221100",
      "Hangu",
      "Main Market",
      60000,
      14,
      "NM",
    ],
    [
      "s5",
      "Healthline Pharmacy",
      "Hamid Raza",
      "03005554433",
      "Peshawar",
      "Hayatabad",
      150000,
      30,
      "HP",
    ],
    [
      "s6",
      "Rehman Medical Store",
      "Asif Rehman",
      "03219998877",
      "Kohat",
      "College Road",
      75000,
      21,
      "RM",
    ],
  ].map(([id, name, owner, phone, city, address, limit, terms, initials]) => ({
    id,
    name,
    owner,
    phone,
    city,
    address,
    limit,
    terms,
    initials,
    status: "Active",
  }));
  const quantities = [1250, 460, 780, 630, 930, 390, 120, 720];
  const batches = products.map((p, i) => ({
    id: "b" + (i + 1),
    productId: p.id,
    number: `${p.manufacturer.slice(0, 2).toUpperCase()}-26${310 + i}`,
    expiry: d(i === 6 ? 24 : 130 + i * 25),
    stock: quantities[i],
    cost: round(p.price * 0.72),
    location: "Main warehouse",
    status: "Saleable",
  }));
  batches.push(
    {
      id: "b9",
      productId: "p1",
      number: "GS-26098",
      expiry: d(38),
      stock: 180,
      cost: 125,
      location: "Main warehouse",
      status: "Saleable",
    },
    {
      id: "b10",
      productId: "p4",
      number: "SE-25904",
      expiry: d(-4),
      stock: 28,
      cost: 300,
      location: "Quarantine",
      status: "Expired",
    },
  );
  const invoices = [
    {
      id: "INV-2026-001",
      shopId: "s1",
      date: d(-35),
      due: d(-5),
      lines: [
        {
          id: "il1",
          productId: "p1",
          batchId: "b1",
          qty: 100,
          bonus: 0,
          rate: 180,
          discount: 0,
        },
        {
          id: "il2",
          productId: "p2",
          batchId: "b2",
          qty: 40,
          bonus: 0,
          rate: 680,
          discount: 0,
        },
      ],
    },
    {
      id: "INV-2026-002",
      shopId: "s2",
      date: d(-26),
      due: d(-5),
      lines: [
        {
          id: "il3",
          productId: "p4",
          batchId: "b4",
          qty: 80,
          bonus: 0,
          rate: 420,
          discount: 0,
        },
        {
          id: "il4",
          productId: "p3",
          batchId: "b3",
          qty: 50,
          bonus: 0,
          rate: 240,
          discount: 0,
        },
      ],
    },
    {
      id: "INV-2026-003",
      shopId: "s3",
      date: d(-12),
      due: d(18),
      lines: [
        {
          id: "il5",
          productId: "p7",
          batchId: "b7",
          qty: 60,
          bonus: 0,
          rate: 780,
          discount: 0,
        },
        {
          id: "il6",
          productId: "p6",
          batchId: "b6",
          qty: 30,
          bonus: 0,
          rate: 320,
          discount: 0,
        },
      ],
    },
    {
      id: "INV-2026-004",
      shopId: "s5",
      date: d(-6),
      due: d(24),
      lines: [
        {
          id: "il7",
          productId: "p2",
          batchId: "b2",
          qty: 70,
          bonus: 0,
          rate: 680,
          discount: 0,
        },
        {
          id: "il8",
          productId: "p8",
          batchId: "b8",
          qty: 100,
          bonus: 0,
          rate: 260,
          discount: 0,
        },
      ],
    },
    {
      id: "INV-2026-005",
      shopId: "s1",
      date: d(-2),
      due: d(28),
      lines: [
        {
          id: "il9",
          productId: "p5",
          batchId: "b5",
          qty: 120,
          bonus: 0,
          rate: 85,
          discount: 0,
        },
        {
          id: "il10",
          productId: "p3",
          batchId: "b3",
          qty: 40,
          bonus: 0,
          rate: 240,
          discount: 0,
        },
      ],
    },
  ].map((i) => ({ ...i, total: totalLines(i.lines) }));
  const payments = [
    {
      id: "RCPT-001",
      shopId: "s1",
      date: d(-3),
      amount: 20000,
      method: "Bank transfer",
      reference: "DEMO-1290",
      allocations: [{ invoiceId: "INV-2026-001", amount: 20000 }],
    },
    {
      id: "RCPT-002",
      shopId: "s2",
      date: d(-1),
      amount: 15000,
      method: "Cash",
      reference: "Collected by accounts",
      allocations: [{ invoiceId: "INV-2026-002", amount: 15000 }],
    },
    {
      id: "RCPT-003",
      shopId: "s3",
      date: d(-1),
      amount: 56400,
      method: "Bank transfer",
      reference: "DEMO-1291",
      allocations: [{ invoiceId: "INV-2026-003", amount: 56400 }],
    },
  ];
  const orders = [
    {
      id: "ORD-001",
      shopId: "s4",
      date: d(-1),
      status: "Draft",
      lines: [
        {
          id: "ol1",
          productId: "p1",
          qty: 80,
          bonus: 0,
          rate: 180,
          discount: 0,
        },
        {
          id: "ol2",
          productId: "p6",
          qty: 20,
          bonus: 0,
          rate: 320,
          discount: 0,
        },
      ],
      total: 20800,
      allocations: [],
    },
    {
      id: "ORD-002",
      shopId: "s6",
      date: today,
      status: "Draft",
      lines: [
        {
          id: "ol3",
          productId: "p3",
          qty: 50,
          bonus: 0,
          rate: 240,
          discount: 0,
        },
      ],
      total: 12000,
      allocations: [],
    },
  ];
  return {
    version: 1,
    today,
    products,
    shops,
    batches,
    invoices,
    payments,
    orders,
    returns: [],
    receivings: [],
    suppliers: [
      {
        id: "sup1",
        name: "GSK Distribution",
        contact: "03001110000",
        city: "Islamabad",
      },
      {
        id: "sup2",
        name: "Getz Pharma Supply",
        contact: "03002220000",
        city: "Karachi",
      },
      {
        id: "sup3",
        name: "Searle Healthcare",
        contact: "03003330000",
        city: "Lahore",
      },
    ],
    audit: [],
    settings: {
      name: "PharmaFlow Distribution",
      phone: "0922 510 240",
      address: "Main Bazaar, Kohat, Pakistan",
      currency: "PKR",
      expiryWarning: 60,
    },
  };
}
function copy(db) {
  return structuredClone(db);
}
function audit(db, action, ref) {
  db.audit.unshift({
    id: uid("log"),
    date: new Date().toISOString(),
    action,
    ref,
  });
}
function requirePositive(n, label, whole = false) {
  if (!Number.isFinite(n) || n <= 0 || (whole && !Number.isInteger(n)))
    throw Error(
      `${label} must be ${whole ? "a whole number" : "a number"} greater than zero.`,
    );
}
export function saveShop(db, values) {
  const n = copy(db);
  if (!values.name.trim() || !values.owner.trim())
    throw Error("Shop name and contact name are required.");
  if (!/^\+?[\d\s-]{8,16}$/.test(values.phone))
    throw Error("Enter a valid contact phone number.");
  if (values.limit < 0 || !Number.isFinite(values.limit))
    throw Error("Credit limit cannot be negative.");
  requirePositive(values.terms, "Payment term", true);
  const item = {
    ...values,
    id: uid("shop"),
    initials: values.name
      .split(" ")
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase(),
    status: "Active",
  };
  n.shops.push(item);
  audit(n, "Shop added", item.name);
  return n;
}
export function saveProduct(db, v) {
  const n = copy(db);
  if (!v.name.trim() || !v.manufacturer.trim())
    throw Error("Product name and manufacturer are required.");
  requirePositive(v.price, "Price");
  requirePositive(v.pack, "Units per pack", true);
  if (v.reorder < 0 || !Number.isInteger(v.reorder))
    throw Error("Reorder point must be a nonnegative whole number.");
  n.products.push({ ...v, id: uid("product"), unit: "pack" });
  audit(n, "Product added", v.name);
  return n;
}
export function receiveStock(db, v) {
  const n = copy(db);
  if (
    !n.products.some((p) => p.id === v.productId) ||
    !n.suppliers.some((s) => s.id === v.supplierId)
  )
    throw Error("Select a product and supplier.");
  if (!v.number.trim()) throw Error("Batch number is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.expiry) || v.expiry <= n.today)
    throw Error("Expiry date must be after today.");
  requirePositive(v.qty, "Quantity", true);
  requirePositive(v.cost, "Cost per pack");
  const batch = {
    id: uid("batch"),
    productId: v.productId,
    number: v.number,
    expiry: v.expiry,
    stock: v.qty,
    cost: v.cost,
    status: "Saleable",
    location: "Main warehouse",
  };
  n.batches.push(batch);
  const rec = { ...v, id: uid("GRN"), date: n.today, batchId: batch.id };
  n.receivings.unshift(rec);
  audit(n, "Stock received", v.number);
  return n;
}
export function createOrder(db, v) {
  const n = copy(db);
  const shop = n.shops.find((s) => s.id === v.shopId);
  if (!shop || shop.status !== "Active") throw Error("Select an active shop.");
  if (!v.lines.length) throw Error("Add at least one product.");
  for (const l of v.lines) {
    if (!n.products.some((p) => p.id === l.productId))
      throw Error("Select a valid product.");
    requirePositive(l.qty, "Quantity", true);
    if (!Number.isInteger(l.bonus) || l.bonus < 0)
      throw Error("Bonus quantity must be a nonnegative whole number.");
    requirePositive(l.rate, "Unit price");
    if (l.discount < 0 || l.discount > 100)
      throw Error("Discount must be from 0 to 100 percent.");
  }
  const order = {
    id: uid("ORD"),
    date: n.today,
    shopId: v.shopId,
    status: "Draft",
    lines: v.lines.map((l) => ({ ...l, id: uid("line") })),
    total: totalLines(v.lines),
    allocations: [],
  };
  n.orders.unshift(order);
  audit(n, "Order created", order.id);
  return n;
}
export function approveOrder(db, id) {
  const n = copy(db),
    o = n.orders.find((x) => x.id === id);
  if (!o || o.status !== "Draft")
    throw Error("Only draft orders can be approved.");
  const shop = n.shops.find((s) => s.id === o.shopId);
  if (shop.status !== "Active")
    throw Error("This shop is blocked for new supply.");
  if (shopBalance(n, shop.id) + commitments(n, shop.id) + o.total > shop.limit)
    throw Error(
      "This order exceeds the shop credit limit. Collect payment or revise the order.",
    );
  const allocations = [];
  for (const line of o.lines) {
    let left = line.qty + line.bonus;
    const candidates = n.batches
      .filter((b) => b.productId === line.productId && eligible(b, n.today))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
    for (const b of candidates) {
      const assigned = allocations
        .filter((a) => a.batchId === b.id)
        .reduce((s, a) => s + a.qty, 0);
      const take = Math.min(
        left,
        Math.max(0, b.stock - reserved(n, b.id) - assigned),
      );
      if (take) {
        allocations.push({ lineId: line.id, batchId: b.id, qty: take });
        left -= take;
      }
      if (!left) break;
    }
    if (left)
      throw Error(
        `Insufficient eligible stock for ${n.products.find((p) => p.id === line.productId).name}.`,
      );
  }
  o.status = "Approved";
  o.allocations = allocations;
  audit(n, "Order approved", o.id);
  return n;
}
export function cancelOrder(db, id) {
  const n = copy(db),
    o = n.orders.find((x) => x.id === id);
  if (!o || !["Draft", "Approved"].includes(o.status))
    throw Error("This order cannot be cancelled.");
  o.status = "Cancelled";
  o.allocations = [];
  audit(n, "Order cancelled", id);
  return n;
}
// Apply advances and credits released by a return to open invoices without changing cash totals.
export function allocateCustomerCredit(db, shopId) {
  const invoices = db.invoices
    .filter((i) => i.shopId === shopId)
    .sort((a, b) => a.due.localeCompare(b.due));
  const capacity = new Map(
    invoices.map((i) => [
      i.id,
      Math.max(0, round(i.total - creditedAmount(db, i.id))),
    ]),
  );
  const payments = db.payments
    .filter((p) => p.shopId === shopId)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const payment of payments) {
    payment.allocations = payment.allocations
      .map((a) => {
        const take = Math.min(a.amount, capacity.get(a.invoiceId) || 0);
        capacity.set(
          a.invoiceId,
          round((capacity.get(a.invoiceId) || 0) - take),
        );
        return { ...a, amount: take };
      })
      .filter((a) => a.amount > 0);
  }
  for (const payment of payments) {
    let credit = round(
      payment.amount - payment.allocations.reduce((s, a) => s + a.amount, 0),
    );
    for (const invoice of invoices) {
      const take = Math.min(credit, capacity.get(invoice.id) || 0);
      if (take > 0) {
        const existing = payment.allocations.find(
          (a) => a.invoiceId === invoice.id,
        );
        if (existing) existing.amount = round(existing.amount + take);
        else payment.allocations.push({ invoiceId: invoice.id, amount: take });
        capacity.set(invoice.id, round(capacity.get(invoice.id) - take));
        credit = round(credit - take);
      }
      if (credit <= 0) break;
    }
  }
  return db;
}
export function deliverOrder(db, id) {
  const n = copy(db),
    o = n.orders.find((x) => x.id === id);
  if (!o || o.status !== "Approved")
    throw Error("Approve the order before confirming delivery.");
  const shop = n.shops.find((s) => s.id === o.shopId);
  if (
    shop.status !== "Active" ||
    shopBalance(n, shop.id) + commitments(n, shop.id, id) + o.total > shop.limit
  )
    throw Error("Shop credit is no longer available.");
  const lines = [];
  for (const l of o.lines) {
    let paidLeft = l.qty;
    for (const a of o.allocations.filter((x) => x.lineId === l.id)) {
      const batch = n.batches.find((b) => b.id === a.batchId);
      if (!eligible(batch, n.today) || batch.stock < a.qty)
        throw Error(
          "Reserved stock is no longer eligible. Cancel and recreate the order.",
        );
      const qty = Math.min(paidLeft, a.qty);
      paidLeft -= qty;
      lines.push({
        ...l,
        id: uid("il"),
        batchId: a.batchId,
        qty,
        bonus: a.qty - qty,
      });
      batch.stock -= a.qty;
    }
  }
  const invoice = {
    id: `INV-${new Date().getFullYear()}-${String(n.invoices.length + 1).padStart(3, "0")}`,
    shopId: o.shopId,
    date: n.today,
    due: addDays(n.today, shop.terms),
    orderId: o.id,
    lines,
    total: totalLines(lines),
  };
  o.status = "Delivered";
  o.invoiceId = invoice.id;
  n.invoices.unshift(invoice);
  allocateCustomerCredit(n, invoice.shopId);
  audit(n, "Delivery confirmed and invoice posted", invoice.id);
  return n;
}
export function recordPayment(db, v) {
  const n = copy(db);
  if (!n.shops.some((s) => s.id === v.shopId)) throw Error("Select a shop.");
  requirePositive(v.amount, "Payment amount");
  if (!["Cash", "Bank transfer", "Digital wallet"].includes(v.method))
    throw Error("Select a valid payment method.");
  if (v.method !== "Cash" && !v.reference.trim())
    throw Error("A transaction reference is required.");
  if (!v.date || v.date > n.today)
    throw Error("Receipt date cannot be in the future.");
  let remaining = round(v.amount);
  const allocations = [];
  for (const i of n.invoices
    .filter((i) => i.shopId === v.shopId && i.date <= v.date)
    .sort((a, b) => a.due.localeCompare(b.due))) {
    const amount = Math.min(remaining, outstanding(n, i));
    if (amount > 0) {
      allocations.push({ invoiceId: i.id, amount });
      remaining = round(remaining - amount);
    }
  }
  const payment = {
    ...v,
    id: uid("RCPT"),
    amount: round(v.amount),
    allocations,
  };
  n.payments.unshift(payment);
  audit(n, "Payment recorded", payment.id);
  return n;
}
export function recordReturn(db, v) {
  const n = copy(db),
    i = n.invoices.find((x) => x.id === v.invoiceId),
    line = i?.lines.find((l) => l.id === v.lineId);
  if (!line) throw Error("Select an invoice and product line.");
  requirePositive(v.qty, "Return quantity", true);
  const prev = n.returns
    .filter((r) => r.invoiceId === i.id && r.lineId === line.id)
    .reduce((s, r) => s + r.qty, 0);
  if (v.qty + prev > line.qty)
    throw Error("Return quantity exceeds charged units delivered.");
  if (!v.reason.trim()) throw Error("Enter a return reason.");
  const batch = n.batches.find((b) => b.id === line.batchId),
    total = round(v.qty * line.rate * (1 - line.discount / 100));
  const ret = {
    ...v,
    id: uid("CN"),
    date: n.today,
    shopId: i.shopId,
    productId: line.productId,
    batchId: batch.id,
    total,
    disposition: "Quarantine",
  };
  n.returns.unshift(ret);
  n.batches.push({
    ...batch,
    id: uid("quarantine"),
    stock: v.qty,
    status: "Quarantine",
    location: "Returns quarantine",
  });
  allocateCustomerCredit(n, i.shopId);
  audit(n, "Return accepted and credit posted", ret.id);
  return n;
}
export function updateSettings(db, settings) {
  const n = copy(db);
  if (!settings.name.trim()) throw Error("Company name is required.");
  if (
    !Number.isInteger(settings.expiryWarning) ||
    settings.expiryWarning < 1 ||
    settings.expiryWarning > 365
  )
    throw Error("Expiry warning must be 1 to 365 days.");
  n.settings = settings;
  audit(n, "Settings updated", settings.name);
  return n;
}
export function toggleShop(db, id) {
  const n = copy(db),
    s = n.shops.find((s) => s.id === id);
  if (!s) throw Error("Shop not found.");
  s.status = s.status === "Active" ? "Blocked" : "Active";
  audit(n, `Shop ${s.status.toLowerCase()}`, s.name);
  return n;
}
export function addSupplier(db, v) {
  const n = copy(db);
  if (!v.name.trim() || !v.city.trim())
    throw Error("Supplier name and city are required.");
  n.suppliers.push({ ...v, id: uid("sup") });
  audit(n, "Supplier added", v.name);
  return n;
}
export function shopStatement(db, id) {
  return [
    ...db.invoices
      .filter((i) => i.shopId === id)
      .map((i) => ({
        date: i.date,
        id: i.id,
        label: "Sales invoice",
        debit: i.total,
        credit: 0,
      })),
    ...db.payments
      .filter((i) => i.shopId === id)
      .map((i) => ({
        date: i.date,
        id: i.id,
        label: `Receipt · ${i.method}`,
        debit: 0,
        credit: i.amount,
      })),
    ...db.returns
      .filter((i) => i.shopId === id)
      .map((i) => ({
        date: i.date,
        id: i.id,
        label: "Return credit",
        debit: 0,
        credit: i.total,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
