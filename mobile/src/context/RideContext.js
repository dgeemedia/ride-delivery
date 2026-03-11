// mobile/src/context/RideContext.js
import React, {createContext, useState, useEffect, useContext} from 'react';
import {rideAPI} from '../services/api';
import socketService from '../services/socket';

const RideContext = createContext();

export const RideProvider = ({children}) => {
  const [activeRide, setActiveRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActiveRide();

    const handleDriverLocation = data => {
      setDriverLocation({
        latitude: data.lat,
        longitude: data.lng,
        heading: data.heading ?? null,
      });
    };

    socketService.on('driver:location:update', handleDriverLocation);
    return () => socketService.off('driver:location:update', handleDriverLocation);
  }, []);

  const loadActiveRide = async () => {
    try {
      const res = await rideAPI.getActiveRide();
      setActiveRide(res.data?.ride ?? null);
    } catch {
      setActiveRide(null);
    }
  };

  const requestRide = async rideData => {
    setLoading(true);
    try {
      const res = await rideAPI.requestRide(rideData);
      const ride = res.data.ride;
      setActiveRide(ride);
      socketService.joinRide(ride.id);
      return ride;
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async (rideId, reason) => {
    setLoading(true);
    try {
      await rideAPI.cancelRide(rideId, {reason});
      socketService.leaveRide(rideId);
      setActiveRide(null);
      setDriverLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const acceptRide = async rideId => {
    setLoading(true);
    try {
      const res = await rideAPI.acceptRide(rideId);
      setActiveRide(res.data.ride);
    } finally {
      setLoading(false);
    }
  };

  const startRide = async rideId => {
    const res = await rideAPI.startRide(rideId);
    setActiveRide(res.data.ride);
  };

  const completeRide = async (rideId, actualFare) => {
    const res = await rideAPI.completeRide(rideId, {actualFare});
    socketService.leaveRide(rideId);
    setActiveRide(null);
    setDriverLocation(null);
    return res.data.ride;
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
      }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => useContext(RideContext);