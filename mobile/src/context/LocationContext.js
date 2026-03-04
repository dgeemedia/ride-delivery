import React, { createContext, useState, useEffect, useContext } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { requestLocationPermission, watchPosition, clearWatch } from '../utils/permissions';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeLocation();

    return () => {
      if (watchId) {
        clearWatch(watchId);
      }
    };
  }, []);

  const initializeLocation = async () => {
    const hasPermission = await requestLocationPermission();
    
    if (hasPermission) {
      startWatchingLocation();
    } else {
      setError('Location permission denied');
    }
  };

  const startWatchingLocation = () => {
    const id = watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
        });
        setError(null);
      },
      (error) => {
        console.error('Location error:', error);
        setError(error.message);
      }
    );
    setWatchId(id);
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(loc);
          resolve(loc);
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        error,
        getCurrentLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);