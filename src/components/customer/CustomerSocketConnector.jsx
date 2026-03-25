import React, { useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { useNotifications } from "../../context/NotificationContext";

/**
 * CustomerSocketConnector - Connects customer to realtime updates
 * Place this inside CustomerNavigator to auto-connect
 *
 * Event names (must match backend socketManager.js):
 * - order:status_update - Order status changes (admin accept, driver updates, etc.)
 * - promotion - Promotional messages
 */
const CustomerSocketConnector = ({ userId }) => {
  const { on, off, isConnected } = useSocket();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!isConnected) return;

    // Handler for order status updates (admin accept, driver pickup, etc.)
    const handleOrderStatusUpdate = (data) => {
      console.log("[CustomerSocket] Received order:status_update:", data);

      // Determine notification type based on event type
      let notificationType = "delivery";
      let title = data.title || "Order Update";
      let message =
        data.message ||
        `Order #${data.order_number || data.orderId} status changed`;

      // Handle different update types
      if (data.type === "order_accepted") {
        title = data.title || "Order Accepted!";
        message =
          data.message || "Your order has been accepted and is being prepared.";
        notificationType = "success";
      } else if (data.type === "driver_nearby") {
        title = data.title || "Driver Nearby!";
        message = data.message || "Your driver is approaching.";
        notificationType = "delivery";
      } else if (data.type === "delivery_started") {
        title = data.title || "On The Way!";
        message = data.message || "Your order is on the way.";
        notificationType = "delivery";
      }

      addNotification({
        title,
        message,
        type: notificationType,
        data,
      });
    };

    const handlePromotion = (data) => {
      console.log("[CustomerSocket] Received promotion:", data);
      addNotification({
        title: data.title || "Special Offer!",
        message: data.message,
        type: "info",
        data,
      });
    };

    // Listen to correct event name matching backend: order:status_update
    on("order:status_update", handleOrderStatusUpdate);
    on("promotion", handlePromotion);

    console.log(
      "[CustomerSocket] Registered listeners for order:status_update, promotion",
    );

    return () => {
      off("order:status_update", handleOrderStatusUpdate);
      off("promotion", handlePromotion);
    };
  }, [isConnected, on, off, addNotification]);

  return null; // Renderless component
};

export default CustomerSocketConnector;
