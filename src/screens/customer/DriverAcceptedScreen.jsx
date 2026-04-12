import React from "react";
import OrderStatusFlowScreen from "./OrderStatusFlowScreen";

export default function DriverAcceptedScreen({ navigation, route }) {
  const nextRoute = {
    ...route,
    params: {
      ...(route?.params || {}),
      status:
        route?.params?.status ||
        route?.params?.delivery_status ||
        route?.params?.effective_status ||
        "accepted",
      statusScreenMode: true,
    },
  };

  return <OrderStatusFlowScreen navigation={navigation} route={nextRoute} />;
}
