import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Inbox,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
export const BusyContext = React.createContext(false);

export function Badge({ children, tone }) {
  const t =
    tone ||
    {
      Active: "green",
      Saleable: "green",
      Approved: "green",
      Delivered: "blue",
      Settled: "green",
      Unpaid: "amber",
      "Partially paid": "blue",
      Draft: "gray",
      Cancelled: "gray",
      Blocked: "red",
      Expired: "red",
      Quarantine: "amber",
      Overdue: "red",
    }[children] ||
    "gray";
  return <span className={`badge ${t}`}>{children}</span>;
}
export function Button({
  children,
  icon: Icon,
  variant = "primary",
  className = "",
  ...props
}) {
  const busy = React.useContext(BusyContext);
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || busy}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
export function Field({ label, children, hint, wide = false }) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Your records will appear here.",
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el.querySelector("input,select,button");
    first?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [
          ...el.querySelectorAll('button,input,select,textarea,[tabindex="0"]'),
        ].filter((x) => !x.disabled);
        if (!items.length) return;
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        className={`modal ${wide ? "wide-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  const Icon = toast.type === "error" ? AlertCircle : CheckCircle2;
  return (
    <div role="status" className={`toast ${toast.type || "success"}`}>
      <Icon size={20} />
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
}
export function Table({
  columns,
  rows,
  emptyText = "No records match your filters.",
  pageSize = 8,
}) {
  const [page, setPage] = useState(1),
    [sort, setSort] = useState(null);
  useEffect(() => setPage(1), [rows.length]);
  let sorted = [...rows];
  if (sort) {
    const c = columns.find((x) => x.key === sort.key);
    sorted.sort((a, b) => {
      const av = c.value ? c.value(a) : a[c.key],
        bv = c.value ? c.value(b) : b[c.key];
      return (
        (typeof av === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""))) *
        (sort.asc ? 1 : -1)
      );
    });
  }
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize)),
    current = Math.min(page, pages);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.align === "right" ? "align-right" : ""}
                >
                  {c.sortable ? (
                    <button
                      className="sort-button"
                      onClick={() =>
                        setSort({
                          key: c.key,
                          asc: sort?.key === c.key ? !sort.asc : true,
                        })
                      }
                    >
                      {c.title}
                      <ArrowUpDown size={12} />
                    </button>
                  ) : (
                    c.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted
              .slice((current - 1) * pageSize, current * pageSize)
              .map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map((c) => (
                    <td
                      className={c.align === "right" ? "align-right" : ""}
                      key={c.key}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty title="No records found" text={emptyText} />
        )}
      </div>
      {rows.length > 0 && (
        <div className="table-footer">
          <span>
            Showing {(current - 1) * pageSize + 1}–
            {Math.min(current * pageSize, rows.length)} of {rows.length} records
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {current} of {pages}
            </span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search records…",
}) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
export function Stat({ label, value, note, icon: Icon, tone = "teal" }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </div>
      </div>
      <strong>{value}</strong>
      <div className="stat-note">{note}</div>
    </div>
  );
}
export function ErrorMessage({ error }) {
  return error ? (
    <div className="form-error" role="alert">
      <AlertCircle size={16} />
      {error}
    </div>
  ) : null;
}
