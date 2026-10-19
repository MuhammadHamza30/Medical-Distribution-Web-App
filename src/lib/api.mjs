export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function request(path, { method = "GET", body, key } = {}) {
  const options = {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  let response;
  try {
    response = await fetch(API_BASE + path, options);
  } catch {
    throw new ApiError(
      "Cannot reach the backend. Check that the API is running and VITE_API_BASE_URL is correct.",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "The API did not return valid JSON. Check the backend URL.",
      response.status,
    );
  }
  if (!response.ok) {
    const fields = data.error?.fields?.fieldErrors;
    const message = fields
      ? Object.entries(fields)
          .map(([k, v]) => `${k}: ${v.join(", ")}`)
          .join(" · ")
      : data.error?.message;
    throw new ApiError(message || "Request failed.", response.status);
  }
  return data;
}
export async function mutateRemote(name, args) {
  const [value] = args;
  const operations = {
    saveShop: ["/shops", "POST", value],
    saveProduct: ["/products", "POST", value],
    addSupplier: ["/suppliers", "POST", value],
    receiveStock: ["/goods-receipts", "POST", value],
    createOrder: ["/orders", "POST", value],
    approveOrder: [`/orders/${encodeURIComponent(value)}/approve`, "POST"],
    cancelOrder: [`/orders/${encodeURIComponent(value)}/cancel`, "POST"],
    deliverOrder: [`/orders/${encodeURIComponent(value)}/deliver`, "POST"],
    recordPayment: ["/payments", "POST", value],
    recordReturn: ["/returns", "POST", value],
    updateSettings: ["/settings", "PATCH", value],
    toggleShop: [`/shops/${encodeURIComponent(value)}/toggle`, "POST"],
  };
  const op = operations[name];
  if (!op)
    throw new ApiError(
      "This operation is not available in connected mode.",
      400,
    );
  const [path, method, body] = op,
    key = crypto.randomUUID();
  let result;
  try {
    result = await request(path, { method, body, key });
  } catch (e) {
    if (e.status !== 0) throw e;
    result = await request(path, { method, body, key });
  }
  if (!result.state)
    throw new ApiError(
      "The connected frontend requires an administrator account.",
      403,
    );
  return result.state;
}
