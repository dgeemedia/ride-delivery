import React, { createContext, useState, useEffect, useContext } from 'react';
import { rideAPI } from '../services/api';
import socketService from '../services/socket';

const RideContext = createContext();

export const RideProvider = ({ children }) => {
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => {
    loadActiveRide();
    
    // Listen for driver location updates
    socketService.on('driver:location:update', handleDriverLocationUpdate);

    return () => {
      socketService.off('driver:location:update');
    };
  }, []);

  const loadActiveRide = async () => {
    try {
      const response = await rideAPI.getActiveRide();
      setActiveRide(response.data.ride);
    } catch (error) {
      console.log('No active ride');
    }
  };

  const handleDriverLocationUpdate = (data) => {
    setDriverLocation({
      latitude: data.lat,
      longitude: data.lng,
      heading: data.heading,
    });
  };

  const requestRide = async (rideData) => {
    setLoading(true);
    try {
      const response = await rideAPI.requestRide(rideData);
      setActiveRide(response.data.ride);
      return response.data.ride;
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async (rideId, reason) => {
    setLoading(true);
    try {
      await rideAPI.cancelRide(rideId, { reason });
      setActiveRide(null);
      setDriverLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const acceptRide = async (rideId) => {
    setLoading(true);
    try {
      const response = await rideAPI.acceptRide(rideId);
      setActiveRide(response.data.ride);
    } finally {
      setLoading(false);
    }
  };

  const startRide = async (rideId) => {
    const response = await rideAPI.startRide(rideId);
    setActiveRide(response.data.ride);
  };

  const completeRide = async (rideId, actualFare) => {
    const response = await rideAPI.completeRide(rideId, { actualFare });
    setActiveRide(null);
    setDriverLocation(null);
    return response.data.ride;
  };

  return (
    <RideContext.Provider
      value={{
        activeRide,
        driverLocation,
        loading,
        requestRide,
        cancelRide,
        acceptRide,
        startRide,
        completeRide,
        refreshActiveRide: loadActiveRide,
      }}
    >
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => useContext(RideContext);