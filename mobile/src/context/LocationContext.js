import React, {createContext, useState, useContext} from 'react';

const LocationContext = createContext();

export const LocationProvider = ({children}) => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);

  const getCurrentLocation = async () => {
    // For Expo Go, we'll use a default location
    // You can add expo-location later for real GPS
    const defaultLocation = {
      latitude: 6.5244,
      longitude: 3.3792,
    };
    setLocation(defaultLocation);
    return defaultLocation;
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        address,
        getCurrentLocation,
        setAddress,
      }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};