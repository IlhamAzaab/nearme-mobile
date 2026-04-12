import React from "react";
import OrderStatusFlowScreen from "./OrderStatusFlowScreen";

export default function PlacingOrderScreen({ navigation, route }) {
  const nextRoute = {
    ...route,
    params: {
      ...(route?.params || {}),
      status: route?.params?.status || "placed",
      statusScreenMode: true,
    },
  };

  return <OrderStatusFlowScreen navigation={navigation} route={nextRoute} />;
}
