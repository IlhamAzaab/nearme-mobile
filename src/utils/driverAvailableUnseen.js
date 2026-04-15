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

function toDeliveryId(item) {
  if (item == null) return null;
  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }

  const id = item.delivery_id ?? item.id;
  return id != null ? String(id) : null;
}

export function syncDriverAvailableUnseenState(userId, deliveries = []) {
  const now = Date.now();
  const state = readState(userId);
  const nextFirstSeenById = {};
  const seenIds = new Set();

  for (const delivery of Array.isArray(deliveries) ? deliveries : []) {
    const id = toDeliveryId(delivery);
    if (!id || seenIds.has(id)) continue;

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

export function markDriverAvailableDeliveriesSeen(userId) {
  const state = readState(userId);
  const nextState = {
    ...state,
    lastSeenAt: Date.now(),
  };

  writeState(userId, nextState);
  return nextState;
}

export function getDriverAvailableUnseenCount(userId) {
  const state = readState(userId);
  let count = 0;

  for (const id of Object.keys(state.firstSeenById || {})) {
    if (Number(state.firstSeenById[id] || 0) > Number(state.lastSeenAt || 0)) {
      count += 1;
    }
  }

  return count;
}
