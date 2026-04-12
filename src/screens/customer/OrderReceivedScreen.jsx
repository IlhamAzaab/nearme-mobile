import React from "react";
import OrderStatusFlowScreen from "./OrderStatusFlowScreen";

export default function OrderReceivedScreen({ navigation, route }) {
  const nextRoute = {
    ...route,
    params: {
      ...(route?.params || {}),
      status: route?.params?.status || "pending",
      statusScreenMode: true,
    },
  };

  return <OrderStatusFlowScreen navigation={navigation} route={nextRoute} />;
}
