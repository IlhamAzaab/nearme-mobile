import { API_BASE_URL } from "../constants/api";

const DEFAULT_SERVICE_FEE_TIERS = [
  { min: 0, fee: 0 },
  { min: 300, fee: 31 },
  { min: 1000, fee: 42 },
  { min: 1500, fee: 56 },
  { min: 2500, fee: 62 },
];

const DEFAULT_DELIVERY_FEE_TIERS = [
  { max_km: 1, fee: 50 },
  { max_km: 2, fee: 80 },
  { max_km: 2.5, fee: 87 },
  { max_km: null, base_fee: 87, extra_per_100m: 2.3, base_km: 2.5 },
];

const DEFAULT_DISTANCE_CONSTRAINTS = [
  { min_km: 0, max_km: 5, min_subtotal: 300 },
  { min_km: 5, max_km: 10, min_subtotal: 1000 },
  { min_km: 10, max_km: 15, min_subtotal: 2000 },
  { min_km: 15, max_km: 25, min_subtotal: 3000 },
];

export const DEFAULT_FEE_CONFIG = {
  service_fee_tiers: DEFAULT_SERVICE_FEE_TIERS,
  delivery_fee_tiers: DEFAULT_DELIVERY_FEE_TIERS,
  order_distance_constraints: DEFAULT_DISTANCE_CONSTRAINTS,
  max_order_distance_km: 25,
};

export async function fetchPublicFeeConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/public/fee-config`);
    if (!res.ok) throw new Error(`fee-config request failed (${res.status})`);
    const raw = await res.json();
    return normalizeFeeConfig(raw);
  } catch {
    return DEFAULT_FEE_CONFIG;
  }
}

export function normalizeFeeConfig(config = {}) {
  const service_fee_tiers = Array.isArray(config.service_fee_tiers)
    ? config.service_fee_tiers
        .map((tier) => ({
          min: Number(tier?.min),
          fee: Number(tier?.fee),
        }))
        .filter(
          (tier) => Number.isFinite(tier.min) && Number.isFinite(tier.fee),
        )
        .sort((a, b) => a.min - b.min)
    : DEFAULT_SERVICE_FEE_TIERS;

  const delivery_fee_tiers = Array.isArray(config.delivery_fee_tiers)
    ? config.delivery_fee_tiers
        .map((tier) => ({
          max_km: tier?.max_km == null ? null : Number(tier.max_km),
          fee: Number(tier?.fee),
          base_fee: Number(tier?.base_fee),
          extra_per_100m: Number(tier?.extra_per_100m),
          base_km: Number(tier?.base_km),
        }))
        .filter((tier) =>
          tier.max_km === null
            ? Number.isFinite(tier.base_fee) &&
              Number.isFinite(tier.extra_per_100m) &&
              Number.isFinite(tier.base_km)
            : Number.isFinite(tier.max_km) && Number.isFinite(tier.fee),
        )
        .sort((a, b) => {
          if (a.max_km === null) return 1;
          if (b.max_km === null) return -1;
          return a.max_km - b.max_km;
        })
    : DEFAULT_DELIVERY_FEE_TIERS;

  const order_distance_constraints = Array.isArray(
    config.order_distance_constraints,
  )
    ? config.order_distance_constraints
        .map((c) => ({
          min_km: Number(c?.min_km),
          max_km: Number(c?.max_km),
          min_subtotal: Number(c?.min_subtotal),
        }))
        .filter(
          (c) =>
            Number.isFinite(c.min_km) &&
            Number.isFinite(c.max_km) &&
            Number.isFinite(c.min_subtotal),
        )
        .sort((a, b) => a.min_km - b.min_km)
    : DEFAULT_DISTANCE_CONSTRAINTS;

  return {
    service_fee_tiers:
      service_fee_tiers.length > 0
        ? service_fee_tiers
        : DEFAULT_SERVICE_FEE_TIERS,
    delivery_fee_tiers:
      delivery_fee_tiers.length > 0
        ? delivery_fee_tiers
        : DEFAULT_DELIVERY_FEE_TIERS,
    order_distance_constraints:
      order_distance_constraints.length > 0
        ? order_distance_constraints
        : DEFAULT_DISTANCE_CONSTRAINTS,
    max_order_distance_km: Number.isFinite(Number(config.max_order_distance_km))
      ? Number(config.max_order_distance_km)
      : 25,
  };
}

export function calculateServiceFee(subtotal, config = DEFAULT_FEE_CONFIG) {
  const amount = Number(subtotal);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const tiers = config.service_fee_tiers || DEFAULT_SERVICE_FEE_TIERS;
  for (let i = tiers.length - 1; i >= 0; i -= 1) {
    if (amount >= tiers[i].min) return tiers[i].fee;
  }
  return 0;
}

export function calculateDeliveryFee(distanceKm, config = DEFAULT_FEE_CONFIG) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return null;

  const tiers = config.delivery_fee_tiers || DEFAULT_DELIVERY_FEE_TIERS;
  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i];
    if (tier.max_km !== null && distance <= tier.max_km) {
      return tier.fee;
    }

    if (tier.max_km === null) {
      const extraMeters = Math.max(0, (distance - tier.base_km) * 1000);
      const extra100mUnits = Math.ceil(extraMeters / 100);
      return tier.base_fee + extra100mUnits * tier.extra_per_100m;
    }
  }

  return null;
}

export function resolveMinimumSubtotal(
  distanceKm,
  config = DEFAULT_FEE_CONFIG,
) {
  const distance = Number(distanceKm);
  const constraints =
    config.order_distance_constraints || DEFAULT_DISTANCE_CONSTRAINTS;

  if (!Number.isFinite(distance) || constraints.length === 0) {
    return DEFAULT_DISTANCE_CONSTRAINTS[0].min_subtotal;
  }

  for (let i = 0; i < constraints.length; i += 1) {
    const c = constraints[i];
    if (distance >= c.min_km && distance < c.max_km) {
      return c.min_subtotal;
    }
  }

  const fallback = constraints[constraints.length - 1];
  return fallback?.min_subtotal ?? DEFAULT_DISTANCE_CONSTRAINTS[0].min_subtotal;
}
