// mobile/src/context/LocationContext.js
import React, {createContext, useState, useContext} from 'react';
import { useCountryCenter } from '../utils/countryGeo';

const LocationContext = createContext();

export const LocationProvider = ({children}) => {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const countryCenter = useCountryCenter();

  const getCurrentLocation = async () => {
    // For Expo Go, we'll use a default location
    // You can add expo-location later for real GPS
    const defaultLocation = {
      latitude: countryCenter.lat,
      longitude: countryCenter.lng,
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