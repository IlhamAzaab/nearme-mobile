import React, { useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import { useSocket } from "../../context/SocketContext";
import { useDriverDeliveryNotifications } from "../../context/DriverDeliveryNotificationContext";

/**
 * DriverSocketConnector - Manages socket connection for driver
 * Listens to all driver-related realtime events from backend
 *
 * Event names (must match backend socketManager.js and routes):
 * - delivery:new - New delivery broadcast to all drivers
 * - delivery:tip_updated - Tip added/updated on a delivery
 * - delivery:taken - Delivery accepted by another driver
 * - driver:delivery_milestone - Daily milestone achievement
 * - driver:deposit_approved - Manager approved driver deposit
 * - driver:payment_received - Manager sent earnings payment to driver
 */
const DriverSocketConnector = ({ driverId, location }) => {
  const { on, off, emit, isConnected } = useSocket();
  const { addNotification } = useDriverDeliveryNotifications();
  const DRIVER_DELIVERY_ACTION_EVENT = "driver:delivery_notification_action";

  // Send location updates to server
  useEffect(() => {
    if (!isConnected || !location) return;

    emit("driver_location_update", {
      driverId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date().toISOString(),
    });
  }, [isConnected, location, driverId, emit]);

  // Listen for delivery and driver events
  useEffect(() => {
    if (!isConnected) return;

    // ───────────────────────────────────────────────────────────────
    // DELIVERY EVENTS (broadcast to all drivers)
    // ───────────────────────────────────────────────────────────────

    const handleNewDelivery = (data) => {
      console.log("[DriverSocket] Received delivery:new:", data);
      addNotification({
        id: data.delivery_id || data.deliveryId,
        title: "New Delivery! 🛵",
        message: `${data.restaurant?.name || "Restaurant"} → ${data.customer?.address || "Customer"}`,
        type: "delivery",
        data,
      });
      DeviceEventEmitter.emit(DRIVER_DELIVERY_ACTION_EVENT, {
        action: "new_delivery",
        deliveryId: data.delivery_id || data.deliveryId,
        payload: data,
        source: "driver_socket_connector",
      });
    };

    const handleTipUpdated = (data) => {
      console.log("[DriverSocket] Received delivery:tip_updated:", data);
      addNotification({
        id: data.delivery_id,
        title: "Tip Added! 💰",
        message: `Rs.${data.tip_amount} tip added to delivery`,
        type: "success",
        data,
      });
    };

    const handleDeliveryTaken = (data) => {
      console.log("[DriverSocket] Received delivery:taken:", data);
      // This event is used to remove the delivery from available list
      // The notification context or delivery list handler will process it
    };

    // ───────────────────────────────────────────────────────────────
    // DRIVER-SPECIFIC EVENTS (targeted to individual driver)
    // ───────────────────────────────────────────────────────────────

    const handleMilestone = (data) => {
      console.log("[DriverSocket] Received driver:delivery_milestone:", data);
      addNotification({
        title: data.title || "🎉 Milestone Achieved!",
        message:
          data.message || `You completed ${data.count} deliveries today!`,
        type: "success",
        data,
      });
    };

    const handleDepositReviewed = (data) => {
      console.log("[DriverSocket] Received driver:deposit_reviewed:", data);

      // data.type will be "deposit_approved" or "deposit_rejected"
      const isApproved =
        data.type === "deposit_approved" || data.status === "approved";

      addNotification({
        title: isApproved ? "✅ Deposit Approved!" : "❌ Deposit Rejected",
        message: isApproved
          ? `Your deposit of Rs.${data.amount} has been approved.${data.approved_amount ? ` Approved amount: Rs.${data.approved_amount}` : ""}`
          : `Your deposit of Rs.${data.amount} was rejected.${data.review_note ? ` Reason: ${data.review_note}` : ""}`,
        type: isApproved ? "success" : "warning",
        data: {
          ...data,
          screen: "DriverDeposits", // Navigation target
        },
      });
    };

    const handlePaymentReceived = (data) => {
      console.log("[DriverSocket] Received driver:payment_received:", data);
      addNotification({
        title: data.title || "💰 Payment Received!",
        message:
          data.message ||
          `Rs.${data.amount} has been transferred to your account.`,
        type: "success",
        data: {
          ...data,
          screen: "Earnings", // Navigation target
        },
      });
    };

    // Register all listeners
    on("delivery:new", handleNewDelivery);
    on("delivery:tip_updated", handleTipUpdated);
    on("delivery:taken", handleDeliveryTaken);
    on("driver:delivery_milestone", handleMilestone);
    on("driver:deposit_reviewed", handleDepositReviewed);
    on("driver:payment_received", handlePaymentReceived);

    console.log(
      "[DriverSocket] Registered listeners for: delivery:new, delivery:tip_updated, delivery:taken, driver:delivery_milestone, driver:deposit_reviewed, driver:payment_received",
    );

    return () => {
      off("delivery:new", handleNewDelivery);
      off("delivery:tip_updated", handleTipUpdated);
      off("delivery:taken", handleDeliveryTaken);
      off("driver:delivery_milestone", handleMilestone);
      off("driver:deposit_reviewed", handleDepositReviewed);
      off("driver:payment_received", handlePaymentReceived);
    };
  }, [isConnected, on, off, addNotification]);

  return null;
};

export default DriverSocketConnector;
