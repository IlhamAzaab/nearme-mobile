const unseenStateByUser = new Map();

const DEFAULT_STATE = {
  lastSeenAt: 0,
  firstSeenById: {},
};

function getUserKey(userId) {
  return String(userId || "default");
}

function readState(userId) {
  const key = getUserKey(userId);
  if (!unseenStateByUser.has(key)) {
    unseenStateByUser.set(key, { ...DEFAULT_STATE, firstSeenById: {} });
  }

  return unseenStateByUser.get(key);
}

function writeState(userId, state) {
  unseenStateByUser.set(getUserKey(userId), state);
}

function normalizeDeliveries(deliveries) {
  if (!deliveries) return [];
  return Array.isArray(deliveries) ? deliveries : [deliveries];
}

function getDeliveryStatus(order) {
  const deliveries = normalizeDeliveries(order?.deliveries);
  const status =
    deliveries[0]?.status || order?.delivery_status || order?.status || "placed";
  return String(status).trim().toLowerCase();
}

function toOrderId(order) {
  const id = order?.id ?? order?.order_id;
  return id != null ? String(id) : null;
}

export function syncAdminOrdersUnseenState(userId, orders = []) {
  const now = Date.now();
  const state = readState(userId);
  const nextFirstSeenById = {};
  const seenIds = new Set();

  for (const order of Array.isArray(orders) ? orders : []) {
    const id = toOrderId(order);
    if (!id || seenIds.has(id)) continue;

    if (getDeliveryStatus(order) !== "placed") continue;

    seenIds.add(id);
    nextFirstSeenById[id] = Number(state.firstSeenById[id] || now);
  }

  const nextState = {
    lastSeenAt: Number(state.lastSeenAt || 0),
    firstSeenById: nextFirstSeenById,
  };

  writeState(userId, nextState);
  return nextState;
}

export function markAdminOrdersSeen(userId) {
  const state = readState(userId);
  const nextState = {
    ...state,
    lastSeenAt: Date.now(),
  };
  writeState(userId, nextState);
  return nextState;
}

export function getAdminOrdersUnseenCount(userId) {
  const state = readState(userId);
  let count = 0;

  for (const id of Object.keys(state.firstSeenById || {})) {
    if (Number(state.firstSeenById[id] || 0) > Number(state.lastSeenAt || 0)) {
      count += 1;
    }
  }

  return count;
}
