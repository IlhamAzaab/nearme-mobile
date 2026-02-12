import { Linking, Platform } from 'react-native';

export const openMaps = async (latitude, longitude, label = 'Destination') => {
  const scheme = Platform.select({
    ios: 'maps:',
    android: 'geo:',
  });
  
  const url = Platform.select({
    ios: `${scheme}${latitude},${longitude}?q=${label}`,
    android: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  });
  
  const canOpen = await Linking.canOpenURL(url);
  
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    // Fallback to Google Maps web
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    );
  }
};

export const openPhone = async (phoneNumber) => {
  const url = `tel:${phoneNumber}`;
  const canOpen = await Linking.canOpenURL(url);
  
  if (canOpen) {
    await Linking.openURL(url);
  }
};

export const openSMS = async (phoneNumber, message = '') => {
  const url = Platform.select({
    ios: `sms:${phoneNumber}&body=${encodeURIComponent(message)}`,
    android: `sms:${phoneNumber}?body=${encodeURIComponent(message)}`,
    default: `sms:${phoneNumber}`,
  });
  
  const canOpen = await Linking.canOpenURL(url);
  
  if (canOpen) {
    await Linking.openURL(url);
  }
};

export const openEmail = async (email, subject = '', body = '') => {
  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const canOpen = await Linking.canOpenURL(url);
  
  if (canOpen) {
    await Linking.openURL(url);
  }
};

export default {
  openMaps,
  openPhone,
  openSMS,
  openEmail,
};
