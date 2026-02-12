export const ORDER_STATUSES = {
  PLACED: "PLACED",
  DRIVER_ACCEPTED: "DRIVER_ACCEPTED",
  RECEIVED: "RECEIVED",
  PICKED_UP: "PICKED_UP",
  ON_THE_WAY: "ON_THE_WAY",
  DELIVERED: "DELIVERED",
};

export function getStatusConfig(status) {
  switch (status) {
    case ORDER_STATUSES.PLACED:
      return {
        statusKey: "PLACED",
        title: "Placing order",
        subtitle: "Confirming with restaurant...",
        etaText: "",
        messageText: "Please wait while we confirm your order.",
        stepIndex: 0,
      };

    case ORDER_STATUSES.DRIVER_ACCEPTED:
      return {
        statusKey: "DRIVER_ACCEPTED",
        title: "Driver accepted",
        subtitle: "Driver is heading to the restaurant",
        etaText: "",
        messageText: "A driver has accepted your delivery.",
        stepIndex: 1,
      };

    case ORDER_STATUSES.RECEIVED:
      return {
        statusKey: "RECEIVED",
        title: "Order received",
        subtitle: "Restaurant is preparing your food",
        etaText: "",
        messageText: "Your order is being prepared.",
        stepIndex: 2,
      };

    case ORDER_STATUSES.PICKED_UP:
      return {
        statusKey: "PICKED_UP",
        title: "Picked up",
        subtitle: "Driver picked your order",
        etaText: "",
        messageText: "Your order is picked up from the restaurant.",
        stepIndex: 3,
      };

    case ORDER_STATUSES.ON_THE_WAY:
      return {
        statusKey: "ON_THE_WAY",
        title: "On the way",
        subtitle: "Driver is coming to you",
        etaText: "ETA updating...",
        messageText: "Track your delivery on the map.",
        stepIndex: 4,
      };

    case ORDER_STATUSES.DELIVERED:
      return {
        statusKey: "DELIVERED",
        title: "Delivered",
        subtitle: "Order delivered successfully",
        etaText: "",
        messageText: "Enjoy your meal!",
        stepIndex: 5,
      };

    default:
      return {
        statusKey: "UNKNOWN",
        title: "Tracking",
        subtitle: "",
        etaText: "",
        messageText: "",
        stepIndex: 0,
      };
  }
}