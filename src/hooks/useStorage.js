import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

export default function useStorage(key, defaultValue = null) {
  const [storedValue, setStoredValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const item = await AsyncStorage.getItem(key);
        setStoredValue(item ? JSON.parse(item) : defaultValue);
      } catch (error) {
        console.error('Error reading from storage:', error);
        setStoredValue(defaultValue);
      } finally {
        setLoading(false);
      }
    })();
  }, [key, defaultValue]);

  const setValue = useCallback(async (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      await AsyncStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(key);
      setStoredValue(defaultValue);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  }, [key, defaultValue]);

  return { storedValue, setValue, removeValue, loading };
}
