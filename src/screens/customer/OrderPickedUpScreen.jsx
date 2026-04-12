import React from "react";
import OrderStatusFlowScreen from "./OrderStatusFlowScreen";

export default function OrderPickedUpScreen({ navigation, route }) {
  const nextRoute = {
    ...route,
    params: {
      ...(route?.params || {}),
      status: route?.params?.status || "picked_up",
      statusScreenMode: true,
    },
  };

  return <OrderStatusFlowScreen navigation={navigation} route={nextRoute} />;
}
