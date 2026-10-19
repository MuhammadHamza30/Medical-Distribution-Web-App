import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  LayoutDashboard,
  Package,
  Store,
  ShoppingCart,
  FileText,
  Wallet,
  RotateCcw,
  Truck,
  BarChart3,
  Settings,
  Plus,
  Search,
  Bell,
  Menu,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Download,
  Check,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Printer,
  Eye,
  MoreHorizontal,
  Boxes,
  TrendingUp,
  ChevronRight,
  LogOut,
  X,
  CircleHelp,
  Activity,
  Building2,
  ClipboardList,
  Ban,
} from "lucide-react";
import {
  BusyContext,
  Badge,
  Button,
  Field,
  Empty,
  Modal,
  Toast,
  Table,
  SearchBox,
  Stat,
  ErrorMessage,
} from "./components/UI.jsx";
import * as M from "./lib/model.mjs";
import logo from "./assets/pharmaflow-logo.png";
const operationNames = new Map(
  [
    "saveShop",
    "saveProduct",
    "addSupplier",
    "receiveStock",
    "createOrder",
    "approveOrder",
    "cancelOrder",
    "deliverOrder",
    "recordPayment",
    "recordReturn",
    "updateSettings",
    "toggleShop",
  ].map((name) => [M[name], name]),
);
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["shops", "Shopkeepers", Store],
  ["inventory", "Inventory", Package],
  ["orders", "Orders & delivery", ShoppingCart],
  ["invoices", "Sales invoices", FileText],
  ["payments", "Collections", Wallet],
  ["returns", "Returns & credits", RotateCcw],
  ["suppliers", "Suppliers", Truck],
  ["reports", "Reports", BarChart3],
  ["settings", "Settings", Settings],
];
const titles = {
  dashboard: [
    "Distribution overview",
    "A clear view of your stock, sales, and collections.",
  ],
  shops: ["Shopkeepers", "Manage your retail network and customer credit."],
  inventory: [
    "Inventory & batches",
    "Know what is available, reserved, and nearing expiry.",
  ],
  orders: ["Orders & delivery", "Move every order from draft to delivered."],
  invoices: [
    "Sales invoices",
    "Track credit sales and the amounts still outstanding.",
  ],
  payments: [
    "Payment collections",
    "Record receipts and keep shop balances up to date.",
  ],
  returns: [
    "Returns & credit notes",
    "Receive returned products and issue customer credits.",
  ],
  suppliers: [
    "Supplier directory",
    "Keep your pharmaceutical supply contacts organized.",
  ],
  reports: [
    "Business reports",
    "Turn your distribution records into clear decisions.",
  ],
  settings: [
    "Workspace settings",
    "Manage company details and workspace data.",
  ],
};
const displayDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const shortId = (id) =>
  id.length > 22 ? id.split("-")[0] + "-" + id.slice(-6).toUpperCase() : id;
function csvDownload(name, headers, rows) {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/"/g, '""')
      .replace(/^[=+@-]/, "'$&") +
    '"';
  download(
    name,
    "text/csv;charset=utf-8",
    "\ufeff" +
      [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n"),
  );
}
function download(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(M.STORAGE_KEY));
    if (
      value?.version === 1 &&
      [
        "products",
        "shops",
        "batches",
        "orders",
        "invoices",
        "payments",
        "returns",
        "suppliers",
        "audit",
      ].every((k) => Array.isArray(value[k]))
    )
      return { ...value, today: M.dateISO() };
  } catch {}
  return M.createSeed();
}
export default function App({
  initialState,
  mode = "demo",
  user,
  onMutation,
  onLogout,
}) {
  const [db, setDb] = useState(() => initialState || readState()),
    [route, setRoute] = useState(() =>
      nav.some((n) => n[0] === location.hash.slice(1))
        ? location.hash.slice(1)
        : "dashboard",
    ),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [inventoryView, setInventoryView] = useState("batches"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [menuOpen, setMenuOpen] = useState(false),
    [storageWarning, setStorageWarning] = useState(false);
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (mode === "api") return;
    try {
      localStorage.setItem(M.STORAGE_KEY, JSON.stringify(db));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [db]);
  useEffect(() => {
    const handler = () => {
      const r = location.hash.slice(1);
      if (nav.some((n) => n[0] === r)) {
        setRoute((current) => {
          if (current !== r) {
            setSearch("");
            setFilter("All");
          }
          return r;
        });
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const go = useCallback((r) => {
    setRoute(r);
    location.hash = r;
    setSearch("");
    setFilter("All");
    setMenuOpen(false);
  }, []);
  const close = useCallback(() => {
      if (!pendingRef.current) setModal(null);
    }, []),
    clearToast = useCallback(() => setToast(null), []);
  const notify = (message) => setToast({ message, type: "success" });
  const perform = async (fn, ...args) => {
    if (pendingRef.current) throw Error("Another request is still processing.");
    pendingRef.current = true;
    setBusy(true);
    try {
      const next = onMutation
        ? await onMutation(operationNames.get(fn), args)
        : fn(db, ...args);
      setDb(next);
      return next;
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };
  const act = async (fn, ...args) => {
    try {
      await perform(fn, ...args);
      notify("Saved successfully.");
      return true;
    } catch (e) {
      setToast({ message: e.message, type: "error" });
      return false;
    }
  };
  const shopName = (id) =>
      db.shops.find((s) => s.id === id)?.name || "Unknown shop",
    productName = (id) =>
      db.products.find((p) => p.id === id)?.name || "Unknown product";
  const matches = (...texts) =>
    texts.join(" ").toLowerCase().includes(search.toLowerCase());
  const open = (type, data) => setModal({ type, data });
  const totalDue = db.shops.reduce(
      (s, x) => s + Math.max(0, M.shopBalance(db, x.id)),
      0,
    ),
    overdue = db.invoices.filter(
      (i) => i.due < db.today && M.outstanding(db, i) > 0,
    ),
    expiring = db.batches.filter(
      (b) =>
        M.eligible(b, db.today) &&
        b.stock > 0 &&
        M.daysBetween(db.today, b.expiry) <= db.settings.expiryWarning,
    ),
    alerts = overdue.length + expiring.length;
  const balanceTag = (value) =>
    value < 0 ? (
      <span className="credit-text">{M.money(-value)} credit</span>
    ) : (
      <strong>{M.money(value)}</strong>
    );
  const invoiceColumns = [
    {
      key: "id",
      title: "Invoice",
      sortable: true,
      render: (i) => (
        <button className="text-link mono" onClick={() => open("invoice", i)}>
          {i.id}
        </button>
      ),
    },
    {
      key: "shopId",
      title: "Shopkeeper",
      render: (i) => (
        <div className="cell-main">
          {shopName(i.shopId)}
          <small>{db.shops.find((s) => s.id === i.shopId)?.city}</small>
        </div>
      ),
    },
    {
      key: "date",
      title: "Issued",
      sortable: true,
      render: (i) => displayDate(i.date),
    },
    {
      key: "due",
      title: "Due date",
      sortable: true,
      render: (i) => (
        <span
          className={
            i.due < db.today && M.outstanding(db, i) > 0 ? "danger-text" : ""
          }
        >
          {displayDate(i.due)}
        </span>
      ),
    },
    {
      key: "total",
      title: "Amount",
      sortable: true,
      align: "right",
      render: (i) => M.money(i.total),
    },
    {
      key: "outstanding",
      title: "Outstanding",
      align: "right",
      value: (i) => M.outstanding(db, i),
      sortable: true,
      render: (i) => <strong>{M.money(M.outstanding(db, i))}</strong>,
    },
    {
      key: "status",
      title: "Status",
      render: (i) => <Badge>{M.invoiceStatus(db, i)}</Badge>,
    },
    {
      key: "action",
      title: "",
      render: (i) => (
        <button
          className="icon-button"
          aria-label={`View ${i.id}`}
          onClick={() => open("invoice", i)}
        >
          <ArrowUpRight size={17} />
        </button>
      ),
    },
  ];
  function exportCurrent() {
    const stamp = db.today;
    if (route === "inventory")
      csvDownload(
        `inventory-${stamp}.csv`,
        [
          "Product",
          "Strength",
          "Batch",
          "Expiry",
          "Status",
          "On hand",
          "Reserved",
          "Cost per pack",
        ],
        db.batches
          .filter(
            (b) =>
              matches(productName(b.productId), b.number) &&
              (filter === "All" ||
                (filter === "Expiring soon" &&
                  expiring.some((e) => e.id === b.id)) ||
                (filter === "Expired" &&
                  (b.status === "Expired" || b.expiry <= db.today)) ||
                (filter === "Saleable" && M.eligible(b, db.today)) ||
                (filter === b.status && filter !== "Saleable")),
          )
          .map((b) => [
            productName(b.productId),
            db.products.find((p) => p.id === b.productId)?.strength,
            b.number,
            b.expiry,
            b.status,
            b.stock,
            M.reserved(db, b.id),
            b.cost,
          ]),
      );
    else if (route === "shops")
      csvDownload(
        `shopkeepers-${stamp}.csv`,
        ["Shop", "Owner", "Phone", "City", "Limit", "Balance", "Status"],
        db.shops
          .filter(
            (s) =>
              matches(s.name, s.owner, s.city) &&
              (filter === "All" || s.status === filter),
          )
          .map((s) => [
            s.name,
            s.owner,
            s.phone,
            s.city,
            s.limit,
            M.shopBalance(db, s.id),
            s.status,
          ]),
      );
    else if (route === "orders")
      csvDownload(
        `orders-${stamp}.csv`,
        ["Order", "Shop", "Date", "Total", "Status"],
        db.orders
          .filter(
            (o) =>
              matches(o.id, shopName(o.shopId)) &&
              (filter === "All" || o.status === filter),
          )
          .map((o) => [o.id, shopName(o.shopId), o.date, o.total, o.status]),
      );
    else if (route === "payments")
      csvDownload(
        `collections-${stamp}.csv`,
        ["Receipt", "Shop", "Date", "Amount", "Method", "Reference"],
        db.payments
          .filter(
            (p) =>
              matches(p.id, shopName(p.shopId), p.reference) &&
              (filter === "All" || p.method === filter),
          )
          .map((p) => [
            p.id,
            shopName(p.shopId),
            p.date,
            p.amount,
            p.method,
            p.reference,
          ]),
      );
    else if (route === "returns")
      csvDownload(
        `returns-${stamp}.csv`,
        [
          "Credit note",
          "Shop",
          "Product",
          "Date",
          "Quantity",
          "Credit",
          "Reason",
        ],
        db.returns
          .filter((r) =>
            matches(r.id, shopName(r.shopId), productName(r.productId)),
          )
          .map((r) => [
            r.id,
            shopName(r.shopId),
            productName(r.productId),
            r.date,
            r.qty,
            r.total,
            r.reason,
          ]),
      );
    else if (route === "suppliers")
      csvDownload(
        `suppliers-${stamp}.csv`,
        ["Supplier", "Phone", "City"],
        db.suppliers
          .filter((s) => matches(s.name, s.city))
          .map((s) => [s.name, s.contact, s.city]),
      );
    else
      csvDownload(
        `receivables-${stamp}.csv`,
        [
          "Invoice",
          "Shop",
          "Issued",
          "Due",
          "Total",
          "Paid",
          "Credited",
          "Outstanding",
        ],
        db.invoices
          .filter(
            (i) =>
              matches(i.id, shopName(i.shopId)) &&
              (filter === "All" ||
                (filter === "Overdue" &&
                  i.due < db.today &&
                  M.outstanding(db, i) > 0) ||
                M.invoiceStatus(db, i) === filter),
          )
          .map((i) => [
            i.id,
            shopName(i.shopId),
            i.date,
            i.due,
            i.total,
            M.paidAmount(db, i.id),
            M.creditedAmount(db, i.id),
            M.outstanding(db, i),
          ]),
      );
    notify("CSV downloaded.");
  }
  const toolbar = (placeholder, filters) => (
    <div className="toolbar">
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder={placeholder}
      />
      <div className="toolbar-right">
        {filters && (
          <select
            aria-label="Filter records"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {filters.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        <Button icon={Download} variant="secondary" onClick={exportCurrent}>
          Export CSV
        </Button>
      </div>
    </div>
  );
  const titleActions = {
    shops: ["Add shopkeeper", "shop"],
    inventory: ["Receive stock", "receive"],
    orders: ["New order", "order"],
    invoices: ["New order", "order"],
    payments: ["Record payment", "payment"],
    returns: ["Accept return", "return"],
    suppliers: ["Add supplier", "supplier"],
  };
  return (
    <BusyContext.Provider value={busy}>
      <div className="app-shell">
        {menuOpen && (
          <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />
        )}
        <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
          <button className="brand" onClick={() => go("dashboard")}>
            <img className="brand-logo" src={logo} alt="PharmaFlow" />
          </button>
          <div className="workspace-switch">
            <span className="workspace-icon">
              <Building2 size={18} />
            </span>
            <div>
              <strong>Main warehouse</strong>
              <small>Kohat, Pakistan</small>
            </div>
            <ShieldCheck size={16} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {nav.map(([id, label, Icon]) => (
              <button
                key={id}
                className={`nav-item ${route === id ? "active" : ""}`}
                onClick={() => go(id)}
                aria-current={route === id ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === "orders" && (
                  <span className="nav-count">
                    {db.orders.filter((o) => o.status === "Draft").length}
                  </span>
                )}
                {id === "invoices" && overdue.length > 0 && (
                  <span className="nav-dot" />
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="demo-card">
              <span className="demo-dot" />{" "}
              {mode === "api" ? "Database connected" : "Frontend demo"}
              <p>
                {mode === "api"
                  ? "Records saved in PostgreSQL."
                  : "Your records stay in this browser."}
              </p>
              <button onClick={() => open("help")}>
                How it works <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="profile">
              <span className="avatar">H</span>
              <div>
                <strong>{user?.name || "Hamza"}</strong>
                <small>Workspace administrator</small>
                {onLogout && (
                  <button className="text-link" onClick={onLogout}>
                    Sign out
                  </button>
                )}
              </div>
              <span className="profile-status" />
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={22} />
              </button>
              <span className="breadcrumb">
                Workspace <ChevronRight size={13} />{" "}
                <strong>{nav.find((x) => x[0] === route)?.[1]}</strong>
              </span>
            </div>
            <div className="topbar-right">
              <span className="header-date">
                <CalendarDays size={16} />
                {displayDate(db.today)}
              </span>
              <button
                className="notification-button"
                onClick={() => open("alerts")}
                aria-label={`View ${alerts} alerts`}
              >
                <Bell size={19} />
                {alerts > 0 && <span />}
              </button>
              <span className="top-avatar">H</span>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  PHARMA DISTRIBUTION <span>·</span>{" "}
                  <span className="live-indicator">
                    {mode === "api" ? "Connected workspace" : "Demo workspace"}
                  </span>
                </div>
                <h1>{titles[route][0]}</h1>
                <p>{titles[route][1]}</p>
              </div>
              <div className="heading-actions">
                {route === "dashboard" ? (
                  <>
                    <Button
                      icon={Wallet}
                      variant="secondary"
                      onClick={() => open("payment")}
                    >
                      Record payment
                    </Button>
                    <Button icon={Plus} onClick={() => open("order")}>
                      New order
                    </Button>
                  </>
                ) : titleActions[route] ? (
                  <Button
                    icon={Plus}
                    onClick={() => open(titleActions[route][1])}
                  >
                    {titleActions[route][0]}
                  </Button>
                ) : route === "reports" ? (
                  <Button
                    icon={Download}
                    variant="secondary"
                    onClick={exportCurrent}
                  >
                    Export receivables
                  </Button>
                ) : null}
              </div>
            </div>
            {storageWarning && (
              <div className="notice amber">
                <AlertTriangle size={18} /> Browser storage is unavailable.
                Changes will last only until you close this page.
              </div>
            )}
            {route === "dashboard" && (
              <>
                <div className="stats-grid">
                  <Stat
                    label="Net sales · last 30 days"
                    value={M.money(
                      db.invoices
                        .filter((i) => M.daysBetween(i.date, db.today) <= 30)
                        .reduce((s, i) => s + i.total, 0) -
                        db.returns
                          .filter((r) => M.daysBetween(r.date, db.today) <= 30)
                          .reduce((s, r) => s + r.total, 0),
                    )}
                    icon={TrendingUp}
                    note={
                      <>
                        <span className="trend">Posted invoices</span> less
                        return credits
                      </>
                    }
                  />
                  <Stat
                    label="Total receivables"
                    value={M.money(totalDue)}
                    icon={Wallet}
                    tone="blue"
                    note={
                      <>
                        <span className="danger-text">
                          {overdue.length} overdue invoices
                        </span>{" "}
                        need attention
                      </>
                    }
                  />
                  <Stat
                    label="Collections · last 30 days"
                    value={M.money(
                      db.payments
                        .filter((p) => M.daysBetween(p.date, db.today) <= 30)
                        .reduce((s, p) => s + p.amount, 0),
                    )}
                    icon={CheckCircle2}
                    tone="violet"
                    note="Cleared cash and bank receipts"
                  />
                  <Stat
                    label="Saleable stock"
                    value={
                      db.batches
                        .filter((b) => M.eligible(b, db.today))
                        .reduce((s, b) => s + b.stock, 0)
                        .toLocaleString() + " packs"
                    }
                    icon={Package}
                    tone="orange"
                    note={
                      <>
                        <span className="trend">
                          {db.products.length} products
                        </span>{" "}
                        across {db.batches.length} batches
                      </>
                    }
                  />
                </div>
                <div className="dashboard-middle">
                  <section className="panel sales-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Sales performance</h2>
                        <p>Posted sales across the past six weeks</p>
                      </div>
                      <Badge tone="gray">Last 6 weeks</Badge>
                    </div>
                    <SalesChart db={db} />
                    <div className="chart-legend">
                      <span>
                        <i className="teal-dot" />
                        Gross sales
                      </span>
                      <span className="muted">
                        Before customer return credits
                      </span>
                    </div>
                  </section>
                  <section className="panel collection-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Credit health</h2>
                        <p>Your retail network at a glance</p>
                      </div>
                      <ShieldCheck size={20} className="teal-text" />
                    </div>
                    <div className="collection-total">
                      <span>Outstanding from shops</span>
                      <strong>{M.money(totalDue)}</strong>
                    </div>
                    <div className="credit-progress">
                      <span
                        style={{
                          width: `${Math.min(
                            100,
                            (totalDue /
                              Math.max(
                                1,
                                db.shops.reduce((s, x) => s + x.limit, 0),
                              )) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="progress-caption">
                      <span>Credit utilization</span>
                      <strong>
                        {Math.round(
                          (totalDue /
                            Math.max(
                              1,
                              db.shops.reduce((s, x) => s + x.limit, 0),
                            )) *
                            100,
                        )}
                        %
                      </strong>
                    </div>
                    <div className="health-row">
                      <div>
                        <span className="health-icon green">
                          <Store size={17} />
                        </span>
                        Active shopkeepers
                      </div>
                      <strong>
                        {db.shops.filter((s) => s.status === "Active").length}
                      </strong>
                    </div>
                    <div className="health-row">
                      <div>
                        <span className="health-icon red">
                          <Clock size={17} />
                        </span>
                        Overdue balance
                      </div>
                      <strong>
                        {M.money(
                          overdue.reduce((s, i) => s + M.outstanding(db, i), 0),
                        )}
                      </strong>
                    </div>
                    <Button
                      variant="secondary"
                      className="full-width"
                      icon={ArrowRight}
                      onClick={() => go("shops")}
                    >
                      View shopkeeper accounts
                    </Button>
                  </section>
                </div>
                <div className="dashboard-bottom">
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recent invoices</h2>
                        <p>Your latest credit sales</p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => go("invoices")}
                      >
                        View all <ArrowRight size={14} />
                      </button>
                    </div>
                    <Table
                      pageSize={4}
                      rows={[...db.invoices].sort((a, b) =>
                        b.date.localeCompare(a.date),
                      )}
                      columns={invoiceColumns.filter((c) =>
                        ["id", "shopId", "total", "status", "action"].includes(
                          c.key,
                        ),
                      )}
                    />
                  </section>
                  <section className="panel attention-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Needs attention</h2>
                        <p>Keep your distribution moving</p>
                      </div>
                      <span className="count-circle">{alerts}</span>
                    </div>
                    <div className="attention-item">
                      <span className="attention-icon orange">
                        <CalendarDays size={18} />
                      </span>
                      <div>
                        <strong>
                          {expiring.length} batches nearing expiry
                        </strong>
                        <p>Within the next {db.settings.expiryWarning} days</p>
                        <button
                          className="text-link"
                          onClick={() => {
                            go("inventory");
                            setFilter("Expiring soon");
                          }}
                        >
                          Review stock <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="attention-item">
                      <span className="attention-icon red">
                        <Wallet size={18} />
                      </span>
                      <div>
                        <strong>{overdue.length} payments are overdue</strong>
                        <p>
                          {M.money(
                            overdue.reduce(
                              (s, i) => s + M.outstanding(db, i),
                              0,
                            ),
                          )}{" "}
                          awaiting collection
                        </p>
                        <button
                          className="text-link"
                          onClick={() => {
                            go("invoices");
                            setFilter("Overdue");
                          }}
                        >
                          Review invoices <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="attention-footer">
                      <ShieldCheck size={14} /> Batch and credit checks enabled
                    </div>
                  </section>
                </div>
                <div className="quick-start">
                  <span className="quick-icon">
                    <ClipboardList size={22} />
                  </span>
                  <div>
                    <strong>Everything begins with an order.</strong>
                    <p>
                      Choose a shop, check available stock, and supply on
                      credit.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={ArrowUpRight}
                    onClick={() => open("order")}
                  >
                    Create your next order
                  </Button>
                </div>
              </>
            )}
            {route === "shops" && (
              <>
                <div className="mini-stats">
                  <span>
                    <strong>{db.shops.length}</strong> shopkeepers
                  </span>
                  <span>
                    <strong>
                      {db.shops.filter((s) => s.status === "Active").length}
                    </strong>{" "}
                    active accounts
                  </span>
                  <span>
                    <strong>{M.money(totalDue)}</strong> total receivables
                  </span>
                </div>
                <section className="panel">
                  {toolbar("Search shop, owner, or city…", [
                    "All",
                    "Active",
                    "Blocked",
                  ])}
                  <Table
                    rows={db.shops.filter(
                      (s) =>
                        matches(s.name, s.owner, s.city) &&
                        (filter === "All" || s.status === filter),
                    )}
                    columns={[
                      {
                        key: "name",
                        title: "Shopkeeper",
                        sortable: true,
                        render: (s) => (
                          <div className="shop-cell">
                            <span className="shop-avatar">{s.initials}</span>
                            <div className="cell-main">
                              {s.name}
                              <small>{s.owner}</small>
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: "city",
                        title: "Location",
                        sortable: true,
                        render: (s) => (
                          <div className="cell-main">
                            {s.city}
                            <small>{s.address}</small>
                          </div>
                        ),
                      },
                      { key: "phone", title: "Contact" },
                      {
                        key: "limit",
                        title: "Credit limit",
                        sortable: true,
                        align: "right",
                        render: (s) => M.money(s.limit),
                      },
                      {
                        key: "balance",
                        title: "Net balance",
                        value: (s) => M.shopBalance(db, s.id),
                        sortable: true,
                        align: "right",
                        render: (s) => balanceTag(M.shopBalance(db, s.id)),
                      },
                      {
                        key: "status",
                        title: "Status",
                        render: (s) => <Badge>{s.status}</Badge>,
                      },
                      {
                        key: "actions",
                        title: "Actions",
                        render: (s) => (
                          <div className="row-actions">
                            <button
                              className="text-link"
                              onClick={() => open("statement", s)}
                            >
                              Statement
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`${s.status === "Active" ? "Block" : "Activate"} ${s.name}`}
                              title={
                                s.status === "Active"
                                  ? "Block new orders"
                                  : "Activate account"
                              }
                              onClick={() => open("toggleShop", s)}
                            >
                              {s.status === "Active" ? (
                                <Ban size={16} />
                              ) : (
                                <Check size={16} />
                              )}
                            </button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </section>
              </>
            )}
            {route === "inventory" && (
              <>
                <div
                  className="tabs"
                  role="tablist"
                  aria-label="Inventory views"
                >
                  <button
                    role="tab"
                    aria-selected={inventoryView === "batches"}
                    className={inventoryView === "batches" ? "selected" : ""}
                    onClick={() => {
                      setInventoryView("batches");
                      setSearch("");
                      setFilter("All");
                    }}
                  >
                    Batch inventory
                  </button>
                  <button
                    role="tab"
                    aria-selected={inventoryView === "products"}
                    className={inventoryView === "products" ? "selected" : ""}
                    onClick={() => {
                      setInventoryView("products");
                      setSearch("");
                      setFilter("All");
                    }}
                  >
                    Product catalog
                  </button>
                </div>
                <div className="inventory-summary">
                  <div>
                    <Package size={18} />
                    <strong>{db.products.length}</strong> registered products
                  </div>
                  <div>
                    <Clock size={18} />
                    <strong>{expiring.length}</strong> expiring batches
                  </div>
                  <Button
                    icon={Plus}
                    variant="secondary"
                    onClick={() => open("product")}
                  >
                    Add product
                  </Button>
                </div>
                {inventoryView === "batches" ? (
                  <section className="panel">
                    {toolbar("Search product or batch number…", [
                      "All",
                      "Saleable",
                      "Expiring soon",
                      "Quarantine",
                      "Expired",
                    ])}
                    <Table
                      rows={db.batches.filter(
                        (b) =>
                          matches(productName(b.productId), b.number) &&
                          (filter === "All" ||
                            (filter === "Expiring soon" &&
                              expiring.some((e) => e.id === b.id)) ||
                            (filter === "Expired" &&
                              (b.status === "Expired" ||
                                b.expiry <= db.today)) ||
                            (filter === "Saleable" &&
                              M.eligible(b, db.today)) ||
                            (filter === b.status && filter !== "Saleable")),
                      )}
                      columns={[
                        {
                          key: "product",
                          title: "Product",
                          value: (b) => productName(b.productId),
                          sortable: true,
                          render: (b) => (
                            <div className="cell-main">
                              {productName(b.productId)}
                              <small>
                                {
                                  db.products.find((p) => p.id === b.productId)
                                    ?.strength
                                }{" "}
                                ·{" "}
                                {
                                  db.products.find((p) => p.id === b.productId)
                                    ?.manufacturer
                                }
                              </small>
                            </div>
                          ),
                        },
                        {
                          key: "number",
                          title: "Batch",
                          render: (b) => (
                            <span className="mono">{b.number}</span>
                          ),
                        },
                        {
                          key: "expiry",
                          title: "Expiry",
                          sortable: true,
                          render: (b) => (
                            <div
                              className={
                                b.expiry <= db.today
                                  ? "danger-text"
                                  : M.daysBetween(db.today, b.expiry) <=
                                      db.settings.expiryWarning
                                    ? "amber-text"
                                    : ""
                              }
                            >
                              {displayDate(b.expiry)}
                              <small className="cell-sub">
                                {b.expiry <= db.today
                                  ? "Expired"
                                  : M.daysBetween(db.today, b.expiry) +
                                    " days remaining"}
                              </small>
                            </div>
                          ),
                        },
                        {
                          key: "stock",
                          title: "On hand",
                          sortable: true,
                          align: "right",
                          render: (b) => (
                            <strong>{b.stock.toLocaleString()}</strong>
                          ),
                        },
                        {
                          key: "reserved",
                          title: "Reserved",
                          align: "right",
                          render: (b) => M.reserved(db, b.id),
                        },
                        {
                          key: "available",
                          title: "Available",
                          align: "right",
                          render: (b) =>
                            M.eligible(b, db.today)
                              ? Math.max(0, b.stock - M.reserved(db, b.id))
                              : 0,
                        },
                        {
                          key: "price",
                          title: "Sell / pack",
                          align: "right",
                          render: (b) =>
                            M.money(
                              db.products.find((p) => p.id === b.productId)
                                ?.price,
                            ),
                        },
                        {
                          key: "status",
                          title: "Status",
                          render: (b) => (
                            <Badge>
                              {b.expiry <= db.today ? "Expired" : b.status}
                            </Badge>
                          ),
                        },
                      ]}
                    />
                  </section>
                ) : (
                  <section className="panel">
                    <div className="toolbar">
                      <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder="Search product, manufacturer, or category…"
                      />
                    </div>
                    <Table
                      rows={db.products.filter((p) =>
                        matches(p.name, p.manufacturer, p.category),
                      )}
                      columns={[
                        {
                          key: "name",
                          title: "Product",
                          sortable: true,
                          render: (p) => (
                            <div className="cell-main">
                              {p.name}
                              <small>
                                {p.strength} · {p.form}
                              </small>
                            </div>
                          ),
                        },
                        {
                          key: "manufacturer",
                          title: "Manufacturer",
                          sortable: true,
                        },
                        { key: "category", title: "Category" },
                        {
                          key: "pack",
                          title: "Units per pack",
                          align: "right",
                        },
                        {
                          key: "price",
                          title: "Sell per pack",
                          sortable: true,
                          align: "right",
                          render: (p) => M.money(p.price),
                        },
                        {
                          key: "reorder",
                          title: "Reorder point",
                          align: "right",
                        },
                        {
                          key: "stock",
                          title: "Available packs",
                          align: "right",
                          render: (p) => (
                            <span
                              className={
                                M.available(db, p.id) < p.reorder
                                  ? "danger-text"
                                  : ""
                              }
                            >
                              {M.available(db, p.id)}
                            </span>
                          ),
                        },
                        {
                          key: "action",
                          title: "",
                          render: (p) => (
                            <button
                              className="text-link"
                              onClick={() =>
                                open("receive", { productId: p.id })
                              }
                            >
                              Receive stock
                            </button>
                          ),
                        },
                      ]}
                    />
                  </section>
                )}
                <div className="notice">
                  <ShieldCheck size={17} /> Available stock excludes
                  reservations, quarantine, and expired batches. Orders allocate
                  eligible batches by earliest expiry.
                </div>
              </>
            )}
            {route === "orders" && (
              <>
                <div className="mini-stats">
                  {["Draft", "Approved", "Delivered"].map((x) => (
                    <span key={x}>
                      <strong>
                        {db.orders.filter((o) => o.status === x).length}
                      </strong>{" "}
                      {x.toLowerCase()} orders
                    </span>
                  ))}
                </div>
                <section className="panel">
                  {toolbar("Search order or shopkeeper…", [
                    "All",
                    "Draft",
                    "Approved",
                    "Delivered",
                    "Cancelled",
                  ])}
                  <Table
                    rows={db.orders.filter(
                      (o) =>
                        matches(o.id, shopName(o.shopId)) &&
                        (filter === "All" || o.status === filter),
                    )}
                    columns={[
                      {
                        key: "id",
                        title: "Order",
                        render: (o) => (
                          <span className="mono">{shortId(o.id)}</span>
                        ),
                      },
                      {
                        key: "shop",
                        title: "Shopkeeper",
                        render: (o) => shopName(o.shopId),
                      },
                      {
                        key: "date",
                        title: "Created",
                        sortable: true,
                        render: (o) => displayDate(o.date),
                      },
                      {
                        key: "items",
                        title: "Products",
                        render: (o) => o.lines.length,
                      },
                      {
                        key: "total",
                        title: "Amount",
                        sortable: true,
                        align: "right",
                        render: (o) => M.money(o.total),
                      },
                      {
                        key: "status",
                        title: "Status",
                        render: (o) => <Badge>{o.status}</Badge>,
                      },
                      {
                        key: "actions",
                        title: "Actions",
                        render: (o) => (
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label="View order details"
                              onClick={() => open("orderView", o)}
                            >
                              <Eye size={16} />
                            </button>
                            {o.status === "Draft" && (
                              <Button
                                variant="small"
                                icon={Check}
                                onClick={() => act(M.approveOrder, o.id)}
                              >
                                Approve
                              </Button>
                            )}
                            {o.status === "Approved" && (
                              <Button
                                variant="small"
                                icon={Truck}
                                onClick={() => open("deliver", o)}
                              >
                                Deliver
                              </Button>
                            )}
                            {["Draft", "Approved"].includes(o.status) && (
                              <button
                                className="icon-button"
                                aria-label="Cancel order"
                                onClick={() => open("cancel", o)}
                              >
                                <X size={16} />
                              </button>
                            )}
                            {o.status === "Delivered" && (
                              <button
                                className="text-link"
                                onClick={() =>
                                  open(
                                    "invoice",
                                    db.invoices.find(
                                      (i) => i.id === o.invoiceId,
                                    ),
                                  )
                                }
                              >
                                Invoice
                              </button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </section>
                <div className="notice">
                  <ShieldCheck size={17} /> Approval reserves stock and credit.
                  Confirming full delivery posts an invoice and deducts the
                  delivered stock.
                </div>
              </>
            )}
            {route === "invoices" && (
              <section className="panel">
                {toolbar("Search invoice or shopkeeper…", [
                  "All",
                  "Unpaid",
                  "Partially paid",
                  "Settled",
                  "Overdue",
                ])}
                <Table
                  columns={invoiceColumns}
                  rows={db.invoices.filter(
                    (i) =>
                      matches(i.id, shopName(i.shopId)) &&
                      (filter === "All" ||
                        (filter === "Overdue" &&
                          i.due < db.today &&
                          M.outstanding(db, i) > 0) ||
                        M.invoiceStatus(db, i) === filter),
                  )}
                />
              </section>
            )}
            {route === "payments" && (
              <>
                <div className="mini-stats">
                  <span>
                    <strong>
                      {M.money(db.payments.reduce((s, p) => s + p.amount, 0))}
                    </strong>{" "}
                    recorded collections
                  </span>
                  <span>
                    <strong>{db.payments.length}</strong> receipts
                  </span>
                  <span>
                    <strong>
                      {M.money(
                        db.shops.reduce(
                          (s, x) => s + Math.max(0, -M.shopBalance(db, x.id)),
                          0,
                        ),
                      )}
                    </strong>{" "}
                    customer credit
                  </span>
                </div>
                <section className="panel">
                  {toolbar("Search receipt, shop, or reference…", [
                    "All",
                    "Cash",
                    "Bank transfer",
                    "Digital wallet",
                  ])}
                  <Table
                    rows={db.payments.filter(
                      (p) =>
                        matches(p.id, shopName(p.shopId), p.reference) &&
                        (filter === "All" || p.method === filter),
                    )}
                    columns={[
                      {
                        key: "id",
                        title: "Receipt",
                        render: (p) => (
                          <span className="mono">{shortId(p.id)}</span>
                        ),
                      },
                      {
                        key: "shop",
                        title: "Shopkeeper",
                        render: (p) => shopName(p.shopId),
                      },
                      {
                        key: "date",
                        title: "Received",
                        sortable: true,
                        render: (p) => displayDate(p.date),
                      },
                      {
                        key: "method",
                        title: "Method",
                        render: (p) => (
                          <Badge tone={p.method === "Cash" ? "green" : "blue"}>
                            {p.method}
                          </Badge>
                        ),
                      },
                      { key: "reference", title: "Reference" },
                      {
                        key: "amount",
                        title: "Amount",
                        sortable: true,
                        align: "right",
                        render: (p) => (
                          <strong className="teal-text">
                            {M.money(p.amount)}
                          </strong>
                        ),
                      },
                      {
                        key: "action",
                        title: "",
                        render: (p) => (
                          <button
                            className="text-link"
                            onClick={() => open("receipt", p)}
                          >
                            View receipt
                          </button>
                        ),
                      },
                    ]}
                  />
                </section>
                <div className="notice">
                  <Wallet size={17} /> Payments apply to the oldest outstanding
                  invoices first. Extra amounts remain as customer credit.
                </div>
              </>
            )}
            {route === "returns" && (
              <>
                <div className="notice amber">
                  <AlertTriangle size={17} /> Accepted returns create a credit
                  note and enter quarantine. Returned stock cannot be sold until
                  a backend inspection workflow releases it.
                </div>
                <section className="panel">
                  {toolbar("Search credit note, product, or shop…")}
                  <Table
                    rows={db.returns.filter((r) =>
                      matches(
                        r.id,
                        shopName(r.shopId),
                        productName(r.productId),
                      ),
                    )}
                    columns={[
                      {
                        key: "id",
                        title: "Credit note",
                        render: (r) => (
                          <span className="mono">{shortId(r.id)}</span>
                        ),
                      },
                      {
                        key: "shop",
                        title: "Shopkeeper",
                        render: (r) => shopName(r.shopId),
                      },
                      {
                        key: "product",
                        title: "Product",
                        render: (r) => productName(r.productId),
                      },
                      {
                        key: "date",
                        title: "Accepted",
                        render: (r) => displayDate(r.date),
                      },
                      { key: "qty", title: "Packs", align: "right" },
                      {
                        key: "total",
                        title: "Credit",
                        align: "right",
                        render: (r) => <strong>{M.money(r.total)}</strong>,
                      },
                      { key: "reason", title: "Reason" },
                      {
                        key: "disposition",
                        title: "Stock",
                        render: (r) => <Badge>Quarantine</Badge>,
                      },
                    ]}
                    emptyText="Accept a return against an existing invoice to create your first credit note."
                  />
                </section>
              </>
            )}
            {route === "suppliers" && (
              <section className="panel">
                {toolbar("Search supplier or city…")}
                <Table
                  rows={db.suppliers.filter((s) => matches(s.name, s.city))}
                  columns={[
                    {
                      key: "name",
                      title: "Supplier",
                      sortable: true,
                      render: (s) => (
                        <div className="shop-cell">
                          <span className="shop-avatar">
                            <Truck size={18} />
                          </span>
                          <div className="cell-main">
                            {s.name}
                            <small>Pharmaceutical supply partner</small>
                          </div>
                        </div>
                      ),
                    },
                    { key: "contact", title: "Phone" },
                    { key: "city", title: "City", sortable: true },
                    {
                      key: "receipts",
                      title: "Receiving records",
                      render: (s) =>
                        db.receivings.filter((r) => r.supplierId === s.id)
                          .length,
                    },
                    {
                      key: "action",
                      title: "",
                      render: (s) => (
                        <Button
                          variant="small"
                          onClick={() => open("receive", { supplierId: s.id })}
                        >
                          Receive stock
                        </Button>
                      ),
                    },
                  ]}
                />
              </section>
            )}
            {route === "reports" && (
              <Reports
                db={db}
                shopName={shopName}
                productName={productName}
                open={open}
              />
            )}
            {route === "settings" && (
              <SettingsPage
                db={db}
                act={act}
                open={open}
                notify={notify}
                mode={mode}
              />
            )}
            <footer className="page-footer">
              <span>
                PharmaFlow <span>·</span> Distribution made clear
              </span>
              <button onClick={() => open("help")}>
                <CircleHelp size={14} /> Demo guide
              </button>
            </footer>
          </main>
        </div>
        {modal && (
          <AppModal
            key={
              modal.type + "-" + (modal.data?.id || modal.data?.shopId || "new")
            }
            modal={modal}
            perform={perform}
            mode={mode}
            db={db}
            setDb={setDb}
            close={close}
            notify={notify}
            act={act}
            open={open}
          />
        )}
        <Toast toast={toast} onClose={clearToast} />
      </div>
    </BusyContext.Provider>
  );
}
function SalesChart({ db }) {
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const start = M.addDays(db.today, -41 + index * 7),
      end = M.addDays(start, 6);
    return {
      label: new Date(start + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      value: db.invoices
        .filter((i) => i.date >= start && i.date <= end)
        .reduce((s, i) => s + i.total, 0),
    };
  });
  const max = Math.max(10000, ...buckets.map((b) => b.value)) * 1.15,
    points = buckets.map((b, i) => [62 + i * 112, 180 - (b.value / max) * 145]),
    path = points.map((p, i) => (i ? "L" : "M") + p.join(",")).join(" ");
  return (
    <div className="sales-chart">
      <svg viewBox="0 0 680 235" role="img" aria-label="Gross sales by week">
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b9382" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0b9382" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="60"
              x2="645"
              y1={35 + i * 48}
              y2={35 + i * 48}
              stroke="#e9edf0"
              strokeDasharray="4 5"
            />
            <text x="3" y={39 + i * 48} fill="#88949f" fontSize="10">
              {Math.round((max * (3 - i)) / 3 / 1000)}k
            </text>
          </g>
        ))}
        <path d={path + " L622,185 L62,185 Z"} fill="url(#area)" />
        <path
          d={path}
          fill="none"
          stroke="#0c8e80"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p[0]}
              cy={p[1]}
              r="4"
              fill="white"
              stroke="#0c8e80"
              strokeWidth="2"
            >
              <title>
                {buckets[i].label}: {M.money(buckets[i].value)}
              </title>
            </circle>
            <text
              x={p[0]}
              y="216"
              textAnchor="middle"
              fill="#88949f"
              fontSize="10"
            >
              {buckets[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function Reports({ db, shopName, productName, open }) {
  const [tab, setTab] = useState("aging");
  const tabs = [
    ["aging", "Receivables aging"],
    ["stock", "Stock valuation"],
    ["sales", "Sales by product"],
    ["activity", "Activity log"],
  ];
  const aging = db.shops.map((s) => {
    const openInvoices = db.invoices.filter((i) => i.shopId === s.id);
    const sum = (min, max) =>
      openInvoices
        .filter((i) => {
          const days = M.daysBetween(i.due, db.today);
          return days >= min && days <= max;
        })
        .reduce((v, i) => v + M.outstanding(db, i), 0);
    return {
      ...s,
      notDue: sum(-99999, 0),
      d30: sum(1, 30),
      d60: sum(31, 60),
      d90: sum(61, 90),
      dOver: sum(91, 99999),
      balance: M.shopBalance(db, s.id),
    };
  });
  const stock = db.products.map((p) => ({
    ...p,
    qty: db.batches
      .filter((b) => b.productId === p.id)
      .reduce((s, b) => s + b.stock, 0),
    value: db.batches
      .filter((b) => b.productId === p.id)
      .reduce((s, b) => s + b.stock * b.cost, 0),
    available: M.available(db, p.id),
  }));
  const sales = db.products.map((p) => {
    const ls = db.invoices
      .flatMap((i) => i.lines)
      .filter((l) => l.productId === p.id);
    const credits = db.returns
      .filter((r) => r.productId === p.id)
      .reduce((s, r) => s + r.total, 0);
    return {
      ...p,
      qty: ls.reduce((s, l) => s + l.qty, 0),
      bonus: ls.reduce((s, l) => s + l.bonus, 0),
      revenue: ls.reduce((s, l) => s + M.lineTotal(l), 0) - credits,
    };
  });
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Report selection">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === tab}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{tabs.find((x) => x[0] === tab)[1]}</h2>
            <p>
              {tab === "aging"
                ? "Open invoice amounts by due date; customer credits are shown separately."
                : tab === "stock"
                  ? "All physical stock, including expired and quarantined batches."
                  : tab === "sales"
                    ? "Posted invoice sales less return credits across all demo dates."
                    : "Changes made in this browser session and saved demo history."}
            </p>
          </div>
          <Badge>As of {displayDate(db.today)}</Badge>
        </div>
        {tab === "aging" && (
          <Table
            rows={aging}
            columns={[
              {
                key: "name",
                title: "Shopkeeper",
                render: (s) => (
                  <button
                    className="text-link"
                    onClick={() => open("statement", s)}
                  >
                    {s.name}
                  </button>
                ),
              },
              ...["notDue", "d30", "d60", "d90", "dOver"].map((key, i) => ({
                key,
                title: [
                  "Not overdue",
                  "1–30 days",
                  "31–60 days",
                  "61–90 days",
                  "90+ days",
                ][i],
                align: "right",
                render: (s) => (
                  <span className={s[key] > 0 && i > 0 ? "danger-text" : ""}>
                    {M.money(s[key])}
                  </span>
                ),
              })),
              {
                key: "balance",
                title: "Net account",
                align: "right",
                render: (s) => <strong>{M.money(s.balance)}</strong>,
              },
            ]}
          />
        )}{" "}
        {tab === "stock" && (
          <Table
            rows={stock}
            columns={[
              { key: "name", title: "Product", sortable: true },
              {
                key: "qty",
                title: "Physical packs",
                sortable: true,
                align: "right",
              },
              {
                key: "available",
                title: "Available packs",
                sortable: true,
                align: "right",
              },
              {
                key: "value",
                title: "Receipt cost value",
                sortable: true,
                align: "right",
                render: (p) => <strong>{M.money(p.value)}</strong>,
              },
            ]}
          />
        )}{" "}
        {tab === "sales" && (
          <Table
            rows={sales}
            columns={[
              { key: "name", title: "Product", sortable: true },
              {
                key: "qty",
                title: "Charged packs",
                sortable: true,
                align: "right",
              },
              { key: "bonus", title: "Bonus packs", align: "right" },
              {
                key: "revenue",
                title: "Net sales",
                sortable: true,
                align: "right",
                render: (p) => <strong>{M.money(p.revenue)}</strong>,
              },
            ]}
          />
        )}{" "}
        {tab === "activity" && (
          <Table
            rows={db.audit}
            emptyText="Create an order or record a payment to see your activity here."
            columns={[
              {
                key: "date",
                title: "Timestamp",
                render: (r) => new Date(r.date).toLocaleString(),
              },
              { key: "action", title: "Action" },
              {
                key: "ref",
                title: "Reference",
                render: (r) => <span className="mono">{shortId(r.ref)}</span>,
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
function SettingsPage({ db, act, open, notify, mode }) {
  const [v, setV] = useState(db.settings);
  const set = (k, x) => setV({ ...v, [k]: x });
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Company details</h2>
            <p>These details appear on printed invoices and statements.</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(M.updateSettings, v);
          }}
        >
          <div className="form-grid">
            <Field label="Business name" wide>
              <input
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Contact phone">
              <input
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <input value="PKR · Pakistani Rupee" disabled />
            </Field>
            <Field label="Business address" wide>
              <textarea
                value={v.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field
              label="Expiry warning threshold"
              hint="Days before expiry to show an alert"
            >
              <input
                type="number"
                min="1"
                max="365"
                value={v.expiryWarning}
                onChange={(e) => set("expiryWarning", Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="form-footer">
            <Button type="submit" icon={Check}>
              Save settings
            </Button>
          </div>
        </form>
      </section>
      <div>
        <section className="panel settings-panel">
          <h2>{mode === "api" ? "Workspace data" : "Demo data"}</h2>
          <p className="muted">
            {mode === "api"
              ? "Business records are stored in PostgreSQL. JSON export is a convenience snapshot; back up the server database separately."
              : "Local browser storage keeps your changes between visits on this device. No server is connected."}
          </p>
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => {
              download(
                "pharmaflow-demo-backup.json",
                "application/json",
                JSON.stringify(db, null, 2),
              );
              notify("Demo data exported as JSON.");
            }}
          >
            {mode === "api" ? "Export workspace snapshot" : "Export demo data"}
          </Button>
          <hr />
          <h3>Start fresh</h3>
          <p className="muted">
            Replace your changes with the original sample records.
          </p>
          <Button
            variant="danger"
            icon={RotateCcw}
            disabled={mode === "api"}
            onClick={() => open("reset")}
          >
            {mode === "api" ? "Demo reset unavailable" : "Reset demo data"}
          </Button>
        </section>
        <div className="notice">
          <ShieldCheck size={20} />
          <span>
            Production needs backend authentication, permissions, database
            transactions, and secure storage. See the included README.
          </span>
        </div>
      </div>
    </div>
  );
}
function AppModal({
  modal,
  db,
  setDb,
  close,
  notify,
  act,
  open,
  perform,
  mode,
}) {
  const { type, data } = modal;
  const shopName = (id) =>
      db.shops.find((s) => s.id === id)?.name || "Unknown shop",
    productName = (id) =>
      db.products.find((p) => p.id === id)?.name || "Unknown product";
  const defaults = {
    shop: {
      name: "",
      owner: "",
      phone: "",
      city: "Kohat",
      address: "",
      limit: 50000,
      terms: 30,
    },
    product: {
      name: "",
      strength: "",
      form: "Tablet",
      manufacturer: "",
      category: "Analgesics",
      price: 0,
      reorder: 30,
      pack: 10,
    },
    receive: {
      supplierId: data?.supplierId || db.suppliers[0]?.id || "",
      productId: data?.productId || db.products[0]?.id || "",
      number: "",
      expiry: M.addDays(db.today, 365),
      qty: 100,
      cost: 100,
    },
    order: {
      shopId:
        data?.shopId || db.shops.find((s) => s.status === "Active")?.id || "",
      lines: [
        {
          productId: db.products[0]?.id || "",
          qty: 10,
          bonus: 0,
          rate: db.products[0]?.price || 0,
          discount: 0,
        },
      ],
    },
    payment: {
      shopId: data?.shopId || db.shops[0]?.id || "",
      date: db.today,
      amount: 0,
      method: "Cash",
      reference: "",
    },
    return: {
      invoiceId: db.invoices[0]?.id || "",
      lineId: db.invoices[0]?.lines.find((l) => l.qty > 0)?.id || "",
      qty: 1,
      reason: "Damaged packaging",
    },
    supplier: { name: "", contact: "", city: "" },
  };
  const [v, setV] = useState(defaults[type] || {}),
    [error, setError] = useState("");
  const set = (k, x) => setV({ ...v, [k]: x });
  const mutation = {
    shop: M.saveShop,
    product: M.saveProduct,
    receive: M.receiveStock,
    order: M.createOrder,
    payment: M.recordPayment,
    return: M.recordReturn,
    supplier: M.addSupplier,
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await perform(mutation[type], v);
      notify(
        type === "order"
          ? "Draft order created. Approve it to reserve stock."
          : type === "return"
            ? "Credit note posted. Returned stock is in quarantine."
            : type === "payment"
              ? "Payment recorded and allocated to outstanding invoices."
              : "Saved successfully.",
      );
      close();
    } catch (e) {
      setError(e.message);
    }
  };
  const formTitles = {
    shop: [
      "Add shopkeeper",
      "Set up a retail account with a credit limit.",
      "Create account",
    ],
    product: [
      "Add product",
      "Inventory is tracked in whole selling packs.",
      "Save product",
    ],
    receive: [
      "Receive stock",
      "Post a new batch into saleable warehouse stock.",
      "Post receiving",
    ],
    order: [
      "Create a new order",
      "Choose the shop and add your distribution products.",
      "Save draft order",
    ],
    payment: [
      "Record a payment",
      "Cash and verified transfers are treated as cleared receipts.",
      "Post payment",
    ],
    return: [
      "Accept a customer return",
      "Creates a credit note and quarantines the returned packs.",
      "Accept and issue credit",
    ],
    supplier: [
      "Add supplier",
      "Register a pharmaceutical supply partner.",
      "Save supplier",
    ],
  };
  const productOptions = db.products.map((p) => (
      <option key={p.id} value={p.id}>
        {p.name} {p.strength}
      </option>
    )),
    shopOptions = db.shops.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
        {s.status === "Blocked" ? " · Blocked" : ""}
      </option>
    ));
  if (mutation[type])
    return (
      <Modal
        title={formTitles[type][0]}
        subtitle={formTitles[type][1]}
        onClose={close}
        wide={type === "order"}
      >
        <form onSubmit={submit}>
          <div className="modal-body">
            <ErrorMessage error={error} />
            {type === "shop" && (
              <div className="form-grid">
                <Field label="Shop name" wide>
                  <input
                    required
                    autoComplete="organization"
                    placeholder="e.g. Al Noor Pharmacy"
                    value={v.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Contact name">
                  <input
                    required
                    value={v.owner}
                    onChange={(e) => set("owner", e.target.value)}
                  />
                </Field>
                <Field label="Contact phone">
                  <input
                    required
                    type="tel"
                    placeholder="0300 1234567"
                    value={v.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>
                <Field label="City">
                  <input
                    required
                    value={v.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </Field>
                <Field label="Payment terms in days">
                  <input
                    required
                    type="number"
                    min="1"
                    max="365"
                    value={v.terms}
                    onChange={(e) => set("terms", Number(e.target.value))}
                  />
                </Field>
                <Field label="Credit limit in PKR">
                  <input
                    required
                    type="number"
                    min="0"
                    value={v.limit}
                    onChange={(e) => set("limit", Number(e.target.value))}
                  />
                </Field>
                <Field label="Street address">
                  <input
                    value={v.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </Field>
              </div>
            )}
            {type === "product" && (
              <div className="form-grid">
                <Field label="Product name" wide>
                  <input
                    required
                    placeholder="e.g. Paracetamol"
                    value={v.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Strength">
                  <input
                    placeholder="500 mg"
                    value={v.strength}
                    onChange={(e) => set("strength", e.target.value)}
                  />
                </Field>
                <Field label="Presentation">
                  <select
                    value={v.form}
                    onChange={(e) => set("form", e.target.value)}
                  >
                    {[
                      "Tablet",
                      "Capsule",
                      "Syrup",
                      "Sachet",
                      "Injection",
                      "Cream",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Manufacturer">
                  <input
                    required
                    value={v.manufacturer}
                    onChange={(e) => set("manufacturer", e.target.value)}
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={v.category}
                    onChange={(e) => set("category", e.target.value)}
                  >
                    {[
                      "Analgesics",
                      "Antibiotics",
                      "Antihistamines",
                      "Gastrointestinal",
                      "Hydration",
                      "Supplements",
                      "Metabolic",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Selling price per pack in PKR">
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={v.price}
                    onChange={(e) => set("price", Number(e.target.value))}
                  />
                </Field>
                <Field label="Units inside one selling pack">
                  <input
                    required
                    type="number"
                    min="1"
                    value={v.pack}
                    onChange={(e) => set("pack", Number(e.target.value))}
                  />
                </Field>
                <Field label="Reorder point in packs">
                  <input
                    required
                    type="number"
                    min="0"
                    value={v.reorder}
                    onChange={(e) => set("reorder", Number(e.target.value))}
                  />
                </Field>
              </div>
            )}
            {type === "receive" && (
              <>
                <div className="form-grid">
                  <Field label="Supplier" wide>
                    <select
                      value={v.supplierId}
                      onChange={(e) => set("supplierId", e.target.value)}
                    >
                      {db.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Product" wide>
                    <select
                      value={v.productId}
                      onChange={(e) => {
                        const p = db.products.find(
                          (p) => p.id === e.target.value,
                        );
                        setV({
                          ...v,
                          productId: p.id,
                          cost: M.round(p.price * 0.72),
                        });
                      }}
                    >
                      {productOptions}
                    </select>
                  </Field>
                  <Field label="Manufacturer batch number">
                    <input
                      required
                      placeholder="e.g. GS-26104"
                      value={v.number}
                      onChange={(e) => set("number", e.target.value)}
                    />
                  </Field>
                  <Field label="Expiry date">
                    <input
                      required
                      type="date"
                      min={M.addDays(db.today, 1)}
                      value={v.expiry}
                      onChange={(e) => set("expiry", e.target.value)}
                    />
                  </Field>
                  <Field label="Quantity in selling packs">
                    <input
                      required
                      type="number"
                      min="1"
                      value={v.qty}
                      onChange={(e) => set("qty", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Receipt cost per pack in PKR">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={v.cost}
                      onChange={(e) => set("cost", Number(e.target.value))}
                    />
                  </Field>
                </div>
                <div className="summary-strip">
                  <span>Receipt stock value</span>
                  <strong>{M.money(v.qty * v.cost)}</strong>
                </div>
                <p className="fine-print">
                  Posts stock only. Supplier invoicing and payable accounts need
                  a backend implementation.
                </p>
              </>
            )}
            {type === "order" && (
              <>
                <div className="form-grid">
                  <Field label="Shopkeeper" wide>
                    <select
                      value={v.shopId}
                      onChange={(e) => set("shopId", e.target.value)}
                    >
                      {shopOptions}
                    </select>
                  </Field>
                </div>
                <div className="order-credit-strip">
                  <div>
                    <span>Current net balance</span>
                    <strong>{M.money(M.shopBalance(db, v.shopId))}</strong>
                  </div>
                  <div>
                    <span>Credit available</span>
                    <strong className="teal-text">
                      {M.money(
                        (db.shops.find((s) => s.id === v.shopId)?.limit || 0) -
                          M.shopBalance(db, v.shopId) -
                          M.commitments(db, v.shopId),
                      )}
                    </strong>
                  </div>
                  <Badge tone="blue">
                    {db.shops.find((s) => s.id === v.shopId)?.terms} day terms
                  </Badge>
                </div>
                <div className="order-lines">
                  {v.lines.map((line, index) => (
                    <div className="order-line" key={index}>
                      <div className="order-line-top">
                        <strong>Product {index + 1}</strong>
                        {v.lines.length > 1 && (
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Remove product ${index + 1}`}
                            onClick={() =>
                              set(
                                "lines",
                                v.lines.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div className="order-line-grid">
                        <Field label="Product">
                          <select
                            value={line.productId}
                            onChange={(e) =>
                              set(
                                "lines",
                                v.lines.map((l, i) =>
                                  i === index
                                    ? {
                                        ...l,
                                        productId: e.target.value,
                                        rate: db.products.find(
                                          (p) => p.id === e.target.value,
                                        ).price,
                                      }
                                    : l,
                                ),
                              )
                            }
                          >
                            {productOptions}
                          </select>
                        </Field>
                        {[
                          ["qty", "Packs", 1, 1],
                          ["bonus", "Bonus", 0, 1],
                          ["rate", "Price / pack", 0.01, 0.01],
                          ["discount", "Discount %", 0, 0.01],
                        ].map(([key, label, min, step]) => (
                          <Field label={label} key={key}>
                            <input
                              required
                              type="number"
                              min={min}
                              max={key === "discount" ? 100 : undefined}
                              step={step}
                              value={line[key]}
                              onChange={(e) =>
                                set(
                                  "lines",
                                  v.lines.map((l, i) =>
                                    i === index
                                      ? { ...l, [key]: Number(e.target.value) }
                                      : l,
                                  ),
                                )
                              }
                            />
                          </Field>
                        ))}
                      </div>
                      <div className="order-line-bottom">
                        <small
                          className={
                            M.available(db, line.productId) <
                            line.qty + line.bonus
                              ? "danger-text"
                              : ""
                          }
                        >
                          {M.available(db, line.productId)} packs available ·{" "}
                          {
                            db.products.find((p) => p.id === line.productId)
                              ?.pack
                          }{" "}
                          units per pack
                        </small>
                        <strong>{M.money(M.lineTotal(line))}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  icon={Plus}
                  onClick={() =>
                    set("lines", [
                      ...v.lines,
                      {
                        productId: db.products[0].id,
                        qty: 1,
                        bonus: 0,
                        rate: db.products[0].price,
                        discount: 0,
                      },
                    ])
                  }
                >
                  Add another product
                </Button>
                <div className="order-total">
                  <span>
                    Order total{" "}
                    <small>Before configured taxes · demo uses no tax</small>
                  </span>
                  <strong>{M.money(M.totalLines(v.lines))}</strong>
                </div>
                <p className="fine-print">
                  Drafts do not reserve stock or credit. Approval checks credit
                  and allocates eligible batches by earliest expiry.
                </p>
              </>
            )}
            {type === "payment" && (
              <>
                <div className="form-grid">
                  <Field label="Shopkeeper" wide>
                    <select
                      value={v.shopId}
                      onChange={(e) => set("shopId", e.target.value)}
                    >
                      {shopOptions}
                    </select>
                  </Field>
                  <Field label="Amount in PKR">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={v.amount}
                      onChange={(e) => set("amount", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Receipt date">
                    <input
                      required
                      type="date"
                      max={db.today}
                      value={v.date}
                      onChange={(e) => set("date", e.target.value)}
                    />
                  </Field>
                  <Field label="Payment method">
                    <select
                      value={v.method}
                      onChange={(e) => set("method", e.target.value)}
                    >
                      {["Cash", "Bank transfer", "Digital wallet"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Transaction reference">
                    <input
                      required={v.method !== "Cash"}
                      placeholder={
                        v.method === "Cash"
                          ? "Optional collection note"
                          : "Required transfer reference"
                      }
                      value={v.reference}
                      onChange={(e) => set("reference", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="summary-strip">
                  <span>Current shop balance</span>
                  <strong>{M.money(M.shopBalance(db, v.shopId))}</strong>
                </div>
                <div className="summary-strip">
                  <span>Balance after this payment</span>
                  <strong className="teal-text">
                    {M.shopBalance(db, v.shopId) - v.amount < 0
                      ? M.money(v.amount - M.shopBalance(db, v.shopId)) +
                        " customer credit"
                      : M.money(M.shopBalance(db, v.shopId) - v.amount)}
                  </strong>
                </div>
                <p className="fine-print">
                  Only enter verified receipts. Payment is allocated against
                  invoices issued by the receipt date, oldest due first.
                </p>
              </>
            )}
            {type === "return" &&
              (() => {
                const invoice = db.invoices.find((i) => i.id === v.invoiceId),
                  line = invoice?.lines.find((l) => l.id === v.lineId);
                const previous = db.returns
                  .filter(
                    (r) => r.invoiceId === v.invoiceId && r.lineId === v.lineId,
                  )
                  .reduce((s, r) => s + r.qty, 0);
                return (
                  <>
                    <div className="form-grid">
                      <Field label="Original invoice" wide>
                        <select
                          value={v.invoiceId}
                          onChange={(e) => {
                            const i = db.invoices.find(
                              (i) => i.id === e.target.value,
                            );
                            setV({
                              ...v,
                              invoiceId: i.id,
                              lineId: i.lines.find((l) => l.qty > 0)?.id || "",
                              qty: 1,
                            });
                          }}
                        >
                          {db.invoices.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.id} · {shopName(i.shopId)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Invoice product and batch" wide>
                        <select
                          value={v.lineId}
                          onChange={(e) =>
                            setV({ ...v, lineId: e.target.value, qty: 1 })
                          }
                        >
                          {invoice?.lines
                            .filter((l) => l.qty > 0)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.productName || productName(l.productId)} ·{" "}
                                {
                                  db.batches.find((b) => b.id === l.batchId)
                                    ?.number
                                }
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field
                        label="Returned charged packs"
                        hint={`${Math.max(0, (line?.qty || 0) - previous)} packs eligible for return`}
                      >
                        <input
                          required
                          type="number"
                          min="1"
                          max={Math.max(0, (line?.qty || 0) - previous)}
                          value={v.qty}
                          onChange={(e) => set("qty", Number(e.target.value))}
                        />
                      </Field>
                      <Field label="Reason">
                        <select
                          value={v.reason}
                          onChange={(e) => set("reason", e.target.value)}
                        >
                          {[
                            "Damaged packaging",
                            "Customer return",
                            "Near expiry",
                            "Product recall",
                            "Incorrect supply",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="summary-strip">
                      <span>Credit at original net price</span>
                      <strong>
                        {M.money(
                          v.qty *
                            (line?.rate || 0) *
                            (1 - (line?.discount || 0) / 100),
                        )}
                      </strong>
                    </div>
                    <p className="fine-print">
                      This demo combines authorized acceptance and credit
                      posting. All returned packs remain in quarantine.
                    </p>
                  </>
                );
              })()}
            {type === "supplier" && (
              <div className="form-grid">
                <Field label="Supplier name" wide>
                  <input
                    required
                    value={v.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    required
                    value={v.contact}
                    onChange={(e) => set("contact", e.target.value)}
                  />
                </Field>
                <Field label="City">
                  <input
                    required
                    value={v.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" icon={type === "order" ? Plus : Check}>
              {formTitles[type][2]}
            </Button>
          </div>
        </form>
      </Modal>
    );
  if (type === "invoice") {
    const i = data,
      shop = db.shops.find((s) => s.id === i.shopId);
    return (
      <Modal
        title="Sales invoice"
        subtitle={`${i.id} · Posted credit sale`}
        onClose={close}
        wide
      >
        <div className="modal-body print-area">
          <div className="invoice-brand">
            <div>
              <h2>{db.settings.name}</h2>
              <p>
                {db.settings.address}
                <br />
                {db.settings.phone}
              </p>
            </div>
            <div className="invoice-label">
              <span>SALES INVOICE</span>
              <strong>{i.id}</strong>
              <Badge>{M.invoiceStatus(db, i)}</Badge>
            </div>
          </div>
          <div className="invoice-meta">
            <div>
              <small>BILL TO</small>
              <strong>{shop.name}</strong>
              <span>
                {shop.owner} · {shop.phone}
              </span>
              <span>
                {shop.address}, {shop.city}
              </span>
            </div>
            <div>
              <span>
                Issued <strong>{displayDate(i.date)}</strong>
              </span>
              <span>
                Due <strong>{displayDate(i.due)}</strong>
              </span>
            </div>
          </div>
          <Table
            pageSize={9999}
            rows={i.lines}
            columns={[
              {
                key: "product",
                title: "Product",
                render: (l) => (
                  <div className="cell-main">
                    {l.productName || productName(l.productId)}
                    <small>
                      {l.strength ||
                        db.products.find((p) => p.id === l.productId)?.strength}
                    </small>
                  </div>
                ),
              },
              {
                key: "batch",
                title: "Batch / expiry",
                render: (l) => (
                  <div className="cell-main mono">
                    {l.batchNumber ||
                      db.batches.find((b) => b.id === l.batchId)?.number}
                    <small>
                      {displayDate(
                        db.batches.find((b) => b.id === l.batchId)?.expiry,
                      )}
                    </small>
                  </div>
                ),
              },
              { key: "qty", title: "Packs", align: "right" },
              { key: "bonus", title: "Bonus", align: "right" },
              {
                key: "rate",
                title: "Unit price",
                align: "right",
                render: (l) => M.money(l.rate),
              },
              {
                key: "discount",
                title: "Disc.",
                align: "right",
                render: (l) => l.discount + "%",
              },
              {
                key: "amount",
                title: "Amount",
                align: "right",
                render: (l) => M.money(M.lineTotal(l)),
              },
            ]}
          />
          <div className="invoice-totals">
            <div>
              <span>Invoice total</span>
              <strong>{M.money(i.total)}</strong>
            </div>
            <div>
              <span>Return credits</span>
              <strong>{M.money(M.creditedAmount(db, i.id))}</strong>
            </div>
            <div>
              <span>Allocated payments</span>
              <strong>{M.money(M.paidAmount(db, i.id))}</strong>
            </div>
            <div className="invoice-due">
              <span>Invoice outstanding</span>
              <strong>{M.money(M.outstanding(db, i))}</strong>
            </div>
          </div>
          <div className="invoice-note">
            All amounts in PKR. Demo invoices apply no tax. Shop net account
            balance: <strong>{M.money(M.shopBalance(db, i.shopId))}</strong>.
            Thank you for your business.
          </div>
        </div>
        <div className="modal-footer">
          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print invoice
          </Button>
          <Button
            icon={Wallet}
            onClick={() => open("payment", { shopId: i.shopId })}
          >
            Record payment
          </Button>
        </div>
      </Modal>
    );
  }
  if (type === "statement") {
    const entries = M.shopStatement(db, data.id);
    let running = 0;
    const rows = entries.map((e) => ({
      ...e,
      balance: (running = M.round(running + e.debit - e.credit)),
    }));
    return (
      <Modal
        title="Customer statement"
        subtitle={`${data.name} · Complete account history`}
        onClose={close}
        wide
      >
        <div className="modal-body print-area">
          <div className="invoice-brand">
            <div>
              <h2>{db.settings.name}</h2>
              <p>{db.settings.address}</p>
            </div>
            <div className="invoice-label">
              <span>CUSTOMER STATEMENT</span>
              <strong>{data.name}</strong>
              <small>As of {displayDate(db.today)}</small>
            </div>
          </div>
          <div className="statement-summary">
            <div>
              <small>Credit limit</small>
              <strong>{M.money(data.limit)}</strong>
            </div>
            <div>
              <small>Payment terms</small>
              <strong>{data.terms} days</strong>
            </div>
            <div>
              <small>Net account balance</small>
              <strong className="teal-text">
                {M.money(M.shopBalance(db, data.id))}
              </strong>
            </div>
          </div>
          <Table
            pageSize={9999}
            rows={rows}
            columns={[
              {
                key: "date",
                title: "Date",
                render: (e) => displayDate(e.date),
              },
              { key: "label", title: "Transaction" },
              {
                key: "id",
                title: "Reference",
                render: (e) => <span className="mono">{shortId(e.id)}</span>,
              },
              {
                key: "debit",
                title: "Debit",
                align: "right",
                render: (e) => (e.debit ? M.money(e.debit) : "—"),
              },
              {
                key: "credit",
                title: "Credit",
                align: "right",
                render: (e) => (e.credit ? M.money(e.credit) : "—"),
              },
              {
                key: "balance",
                title: "Balance",
                align: "right",
                render: (e) => <strong>{M.money(e.balance)}</strong>,
              },
            ]}
          />
          <p className="fine-print">
            A negative net balance is a customer advance or credit. Posted
            invoices and credits are shown independently of payment allocation.
          </p>
        </div>
        <div className="modal-footer">
          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print statement
          </Button>
          <Button
            icon={Wallet}
            onClick={() => open("payment", { shopId: data.id })}
          >
            Record payment
          </Button>
        </div>
      </Modal>
    );
  }
  if (type === "receipt") {
    const p = data;
    return (
      <Modal title="Payment receipt" subtitle={shortId(p.id)} onClose={close}>
        <div className="modal-body print-area">
          <h2>{db.settings.name}</h2>
          <div className="receipt-value">
            {M.money(p.amount)}
            <Badge tone="green">Cleared receipt</Badge>
          </div>
          <dl className="detail-list">
            <dt>Shopkeeper</dt>
            <dd>{shopName(p.shopId)}</dd>
            <dt>Received on</dt>
            <dd>{displayDate(p.date)}</dd>
            <dt>Method</dt>
            <dd>{p.method}</dd>
            <dt>Reference</dt>
            <dd>{p.reference || "—"}</dd>
          </dl>
          <h3>Invoice allocations</h3>
          {p.allocations.length ? (
            p.allocations.map((a) => (
              <div className="summary-strip" key={a.invoiceId}>
                <span>{a.invoiceId}</span>
                <strong>{M.money(a.amount)}</strong>
              </div>
            ))
          ) : (
            <p className="muted">No invoice allocation at posting.</p>
          )}
          <div className="summary-strip">
            <span>Currently unallocated</span>
            <strong>
              {M.money(
                p.amount - p.allocations.reduce((s, a) => s + a.amount, 0),
              )}
            </strong>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
          <Button icon={Printer} onClick={() => window.print()}>
            Print receipt
          </Button>
        </div>
      </Modal>
    );
  }
  if (type === "orderView") {
    return (
      <Modal
        title="Order details"
        subtitle={shortId(data.id)}
        onClose={close}
        wide
      >
        <div className="modal-body">
          <div className="summary-strip">
            <span>{shopName(data.shopId)}</span>
            <Badge>{data.status}</Badge>
          </div>
          <Table
            pageSize={9999}
            rows={data.lines}
            columns={[
              {
                key: "product",
                title: "Product",
                render: (l) => productName(l.productId),
              },
              { key: "qty", title: "Charged packs", align: "right" },
              { key: "bonus", title: "Bonus", align: "right" },
              {
                key: "rate",
                title: "Rate",
                align: "right",
                render: (l) => M.money(l.rate),
              },
              {
                key: "amount",
                title: "Amount",
                align: "right",
                render: (l) => M.money(M.lineTotal(l)),
              },
            ]}
          />
          <div className="summary-strip">
            <span>Total</span>
            <strong>{M.money(data.total)}</strong>
          </div>
          {data.allocations?.length > 0 && (
            <>
              <h3>Reserved batches</h3>
              {data.allocations.map((a, index) => (
                <div className="summary-strip" key={index}>
                  <span>
                    {db.batches.find((b) => b.id === a.batchId)?.number}
                  </span>
                  <strong>{a.qty} packs</strong>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }
  if (["deliver", "cancel", "reset", "toggleShop"].includes(type)) {
    const content = {
      deliver: [
        "Confirm full delivery",
        "Confirm that all ordered products have been delivered. This will deduct stock and post a credit invoice.",
        "Confirm delivery",
      ],
      cancel: [
        "Cancel this order",
        "This releases any reserved stock and credit. The cancelled order stays in your history.",
        "Cancel order",
      ],
      reset: [
        "Reset demo workspace",
        "This removes your local demo changes and restores the original sample records. Export your data first if you want to keep it.",
        "Reset demo",
      ],
      toggleShop: [
        data?.status === "Active" ? "Block new supply" : "Activate shop",
        data?.status === "Active"
          ? "New orders will be blocked. You can still collect payments and process returns."
          : "This shop will be able to place orders within its credit limit.",
        "Confirm change",
      ],
    }[type];
    const execute = async () => {
      let ok;
      if (type === "reset") {
        setDb(M.createSeed());
        notify("Original demo data restored.");
        ok = true;
      } else if (type === "deliver") ok = await act(M.deliverOrder, data.id);
      else if (type === "cancel") ok = await act(M.cancelOrder, data.id);
      else ok = await act(M.toggleShop, data.id);
      if (ok) close();
    };
    return (
      <Modal title={content[0]} onClose={close}>
        <div className="modal-body">
          <p className="confirm-copy">{content[1]}</p>
          {data?.total !== undefined && (
            <div className="summary-strip">
              <span>{shopName(data.shopId)}</span>
              <strong>{M.money(data.total)}</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>
            Go back
          </Button>
          <Button
            variant={["reset", "cancel"].includes(type) ? "danger" : "primary"}
            onClick={execute}
          >
            {content[2]}
          </Button>
        </div>
      </Modal>
    );
  }
  if (type === "alerts") {
    const near = db.batches.filter(
      (b) =>
        M.eligible(b, db.today) &&
        b.stock > 0 &&
        M.daysBetween(db.today, b.expiry) <= db.settings.expiryWarning,
    );
    const late = db.invoices.filter(
      (i) => i.due < db.today && M.outstanding(db, i) > 0,
    );
    return (
      <Modal
        title="Workspace alerts"
        subtitle="Stock expiry and overdue collections"
        onClose={close}
      >
        <div className="modal-body">
          <h3>Approaching expiry</h3>
          {near.length ? (
            near.map((b) => (
              <div className="alert-row" key={b.id}>
                <CalendarDays size={19} />
                <div>
                  <strong>{productName(b.productId)}</strong>
                  <p>
                    {b.number} · {b.stock} packs · expires{" "}
                    {displayDate(b.expiry)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No batches near expiry.</p>
          )}
          <h3>Overdue invoices</h3>
          {late.length ? (
            late.map((i) => (
              <div className="alert-row" key={i.id}>
                <Clock size={19} />
                <div>
                  <button
                    className="text-link"
                    onClick={() => open("invoice", i)}
                  >
                    {shopName(i.shopId)}
                  </button>
                  <p>
                    {i.id} · {M.money(M.outstanding(db, i))} ·{" "}
                    {M.daysBetween(i.due, db.today)} days overdue
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No overdue invoices.</p>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }
  if (type === "help")
    return (
      <Modal
        title="Your distribution demo"
        subtitle="A working frontend with browser-local records"
        onClose={close}
      >
        <div className="modal-body help-copy">
          <ol>
            <li>
              <strong>Receive stock.</strong> Add a product or receive a batch
              with quantity, cost and expiry.
            </li>
            <li>
              <strong>Create an order.</strong> Select a shop and add packs,
              prices, bonuses and discounts.
            </li>
            <li>
              <strong>Approve and deliver.</strong> Approval checks credit and
              reserves eligible batches. Full delivery creates an invoice.
            </li>
            <li>
              <strong>Collect payment.</strong> Verified receipts apply to the
              oldest due invoices. Extra payment becomes customer credit.
            </li>
            <li>
              <strong>Accept a return.</strong> Issue a credit at the original
              net price and place returned stock in quarantine.
            </li>
          </ol>
          <p>
            This workspace can run as a browser-local demo or connect to the
            included authenticated PostgreSQL API. The connected mode requires
            administrator credentials. Sample medicine records are catalog
            examples. Tax configuration and local operating requirements need
            business review.
          </p>
          <p>
            Partial deliveries, multiunit selling, consignment, detailed
            supplier accounts and stock inspection release are backend extension
            points described in the README.
          </p>
        </div>
        <div className="modal-footer">
          <Button onClick={close}>Got it</Button>
        </div>
      </Modal>
    );
  return null;
}
