import React, { createContext, useContext, useState, useEffect } from 'react';
import useLocation from '../hooks/useLocation';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const { location, error, loading, refreshLocation } = useLocation();
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const value = {
    currentLocation: location,
    locationError: error,
    locationLoading: loading,
    refreshLocation,
    selectedAddress,
    setSelectedAddress,
    savedAddresses,
    setSavedAddresses,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
