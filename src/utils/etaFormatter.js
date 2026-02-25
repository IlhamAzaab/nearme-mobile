/**
 * ETA Formatter Utility
 * Formats estimated time of arrival for display
 */

/**
 * Format ETA as clock arrival time(s).
 * Example: etaRangeMin=12, etaRangeMax=22, current time 10:30 PM → "10:42 PM - 10:52 PM"
 * For on_the_way: single time + "Insha Allah"
 */
export function formatETAClockTime(etaRangeMin, etaRangeMax, options = {}) {
  const now = new Date();
  const arriveEarly = new Date(now.getTime() + etaRangeMin * 60000);
  const arriveLate = new Date(now.getTime() + etaRangeMax * 60000);

  const fmt = (d) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  if (etaRangeMin === etaRangeMax || options.isOnTheWay) {
    const time = fmt(arriveEarly);
    return options.isOnTheWay ? `${time} Insha Allah` : time;
  }

  return `${fmt(arriveEarly)} - ${fmt(arriveLate)}`;
}

/**
 * Build display string from backend ETA data.
 */
export function getFormattedETA(etaData, fallback = "Calculating...") {
  if (!etaData) return fallback;
  const { etaRangeMin, etaRangeMax, driverStatus } = etaData;
  if (etaRangeMin == null || etaRangeMax == null) return fallback;
  const isOnTheWay =
    driverStatus === "on_the_way" || driverStatus === "at_customer";
  return formatETAClockTime(etaRangeMin, etaRangeMax, { isOnTheWay });
}

/**
 * Format minutes into a human-readable ETA string
 * @param {number} minutes - ETA in minutes
 * @returns {string} Formatted ETA string
 */
export const formatETA = (minutes) => {
  if (!minutes || minutes <= 0) return 'Arriving soon';

  if (minutes < 1) return 'Less than a minute';
  if (minutes < 60) {
    const rounded = Math.round(minutes);
    return `${rounded} min${rounded !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);

  if (remainingMins === 0) {
    return `${hours} hr${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours !== 1 ? 's' : ''} ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`;
};

/**
 * Format a timestamp into a relative time string
 * @param {Date|string} timestamp
 * @returns {string}
 */
export const formatRelativeTime = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

/**
 * Calculate ETA from distance and average speed
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} avgSpeedKmh - Average speed in km/h (default 30)
 * @returns {number} ETA in minutes
 */
export const calculateETAFromDistance = (distanceKm, avgSpeedKmh = 30) => {
  if (!distanceKm || distanceKm <= 0) return 0;
  return (distanceKm / avgSpeedKmh) * 60;
};

/**
 * Format ETA range (e.g., "15-25 mins")
 * @param {number} minMinutes
 * @param {number} maxMinutes
 * @returns {string}
 */
export const formatETARange = (minMinutes, maxMinutes) => {
  const min = Math.round(minMinutes);
  const max = Math.round(maxMinutes);
  return `${min}-${max} mins`;
};

export default {
  formatETA,
  formatRelativeTime,
  calculateETAFromDistance,
  formatETARange,
  formatETAClockTime,
  getFormattedETA,
};
