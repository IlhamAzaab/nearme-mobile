import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

export const platformSelect = (options) => {
  return Platform.select({
    ios: options.ios,
    android: options.android,
    web: options.web,
    default: options.default || options.android,
  });
};

export const getPlatformShadow = (elevation = 4) => {
  if (isAndroid) {
    return { elevation };
  }
  
  if (isIOS) {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.25,
      shadowRadius: elevation,
    };
  }
  
  return {
    boxShadow: `0 ${elevation / 2}px ${elevation}px rgba(0, 0, 0, 0.25)`,
  };
};

export default {
  isIOS,
  isAndroid,
  isWeb,
  platformSelect,
  getPlatformShadow,
};
