import CustomerScreenAnimator from "../components/common/CustomerScreenAnimator";

const wrappedScreenCache = new WeakMap();

export default function wrapCustomerScreen(ScreenComponent) {
  if (!ScreenComponent) return ScreenComponent;

  const existing = wrappedScreenCache.get(ScreenComponent);
  if (existing) return existing;

  const WrappedScreen = (props) => (
    <CustomerScreenAnimator>
      <ScreenComponent {...props} />
    </CustomerScreenAnimator>
  );

  WrappedScreen.displayName = `CustomerAnimated(${ScreenComponent.displayName || ScreenComponent.name || "Screen"})`;

  wrappedScreenCache.set(ScreenComponent, WrappedScreen);
  return WrappedScreen;
}
