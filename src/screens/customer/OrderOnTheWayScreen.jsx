import React from "react";
import OrderStatusFlowScreen from "./OrderStatusFlowScreen";

export default function OrderOnTheWayScreen({ navigation, route }) {
  const nextRoute = {
    ...route,
    params: {
      ...(route?.params || {}),
      status: route?.params?.status || "on_the_way",
      statusScreenMode: true,
    },
  };

  return <OrderStatusFlowScreen navigation={navigation} route={nextRoute} />;
}
