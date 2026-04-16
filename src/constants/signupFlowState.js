export const SIGNUP_FLOW_STATE_KEY = "@auth:signupFlowState";

const SIGNUP_FLOW_ROUTES = new Set(["Signup", "VerifyOtp", "CompleteProfile"]);

export function isSignupFlowRoute(routeName) {
  return SIGNUP_FLOW_ROUTES.has(String(routeName || ""));
}

export function buildSignupFlowState(routeName, params = {}) {
  return {
    routeName,
    params,
    updatedAt: Date.now(),
  };
}

export function sanitizeSignupFlowState(rawState) {
  if (!rawState || typeof rawState !== "object") return null;

  const routeName = String(rawState.routeName || "").trim();
  if (!isSignupFlowRoute(routeName)) return null;

  const incomingParams =
    rawState.params && typeof rawState.params === "object"
      ? rawState.params
      : {};

  if (routeName === "VerifyOtp") {
    const phone = String(
      incomingParams.phone || incomingParams.prefillPhone || "",
    ).trim();

    if (!phone) return null;

    return {
      routeName,
      params: {
        ...incomingParams,
        phone,
        prefillPhone: phone,
        nextScreen: incomingParams.nextScreen || "CompleteProfile",
      },
    };
  }

  if (routeName === "CompleteProfile") {
    const phone = String(
      incomingParams.prefillPhone || incomingParams.phone || "",
    ).trim();

    return {
      routeName,
      params: {
        ...incomingParams,
        prefillPhone: phone,
      },
    };
  }

  return {
    routeName,
    params: {},
  };
}