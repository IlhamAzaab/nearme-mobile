import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

const lightTheme = {
  background: '#ffffff',
  surface: '#f5f5f5',
  primary: '#007AFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e0e0e0',
};

const darkTheme = {
  background: '#000000',
  surface: '#1c1c1e',
  primary: '#0A84FF',
  text: '#ffffff',
  textSecondary: '#999999',
  border: '#333333',
};

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState(systemColorScheme || 'light');

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
