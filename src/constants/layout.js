import { Dimensions, Platform, StatusBar } from 'react-native';

const { width, height } = Dimensions.get('window');

export const Layout = {
  window: {
    width,
    height,
  },
  screen: Dimensions.get('screen'),
  isSmallDevice: width < 375,
  isMediumDevice: width >= 375 && width < 414,
  isLargeDevice: width >= 414,
  
  // Common spacing values
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border radius
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  // Header heights
  headerHeight: Platform.select({
    ios: 44,
    android: 56,
    default: 56,
  }),
  
  // Tab bar height
  tabBarHeight: Platform.select({
    ios: 49,
    android: 56,
    default: 56,
  }),
  
  // Status bar height
  statusBarHeight: Platform.select({
    ios: 44,
    android: StatusBar.currentHeight || 24,
    default: 24,
  }),
  
  // Safe area (approximate values, use SafeAreaView for accurate)
  safeArea: {
    top: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
    bottom: Platform.OS === 'ios' ? 34 : 0,
  },
};

export default Layout;
