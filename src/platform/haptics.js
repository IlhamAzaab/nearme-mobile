import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isSupported = Platform.OS !== 'web';

export const hapticFeedback = {
  light: async () => {
    if (isSupported) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
  
  medium: async () => {
    if (isSupported) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },
  
  heavy: async () => {
    if (isSupported) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },
  
  success: async () => {
    if (isSupported) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  
  warning: async () => {
    if (isSupported) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },
  
  error: async () => {
    if (isSupported) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
  
  selection: async () => {
    if (isSupported) {
      await Haptics.selectionAsync();
    }
  },
};

export default hapticFeedback;
