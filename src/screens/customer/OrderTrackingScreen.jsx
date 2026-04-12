import React from "react";
import OrderStatusFlowScreen from "./OrderStatusFlowScreen";

export default function OrderTrackingScreen({ route, navigation }) {
  const nextRoute = {
    ...route,
    params: {
      ...(route?.params || {}),
      status:
        route?.params?.status ||
        route?.params?.order?.effective_status ||
        route?.params?.order?.delivery_status ||
        route?.params?.order?.status ||
        "placed",
      statusScreenMode: true,
    },
  };

  return <OrderStatusFlowScreen route={nextRoute} navigation={navigation} />;
}
