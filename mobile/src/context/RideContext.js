// mobile/src/context/RideContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { rideAPI }   from '../services/api';
import socketService from '../services/socket';

const RideContext = createContext(null);

export const RideProvider = ({ children }) => {
  const [activeRide,     setActiveRide]     = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading,        setLoading]        = useState(false);

  useEffect(() => {
    loadActiveRide();

    const handleDriverLocation = (data) => {
      setDriverLocation({ latitude: data.lat, longitude: data.lng, heading: data.heading ?? null });
    };

    socketService.on('driver:location:update', handleDriverLocation);
    socketService.connect().catch(() => {});

    return () => socketService.off('driver:location:update', handleDriverLocation);
  }, []);

  const loadActiveRide = async () => {
    try {
      const res  = await rideAPI.getActiveRide();
      const ride = res?.data?.ride ?? res?.ride ?? null;
      setActiveRide(ride);
      if (ride?.id) socketService.joinRide(ride.id);
    } catch { setActiveRide(null); }
  };

  const requestRide = async (rideData) => {
    setLoading(true);
    try {
      const res  = await rideAPI.requestRide(rideData);
      const ride = res?.data?.ride ?? res?.ride;
      setActiveRide(ride);
      if (ride?.id) socketService.joinRide(ride.id);
      return ride;
    } finally { setLoading(false); }
  };

  const cancelRide = async (rideId, reason) => {
    setLoading(true);
    try {
      await rideAPI.cancelRide(rideId, { reason });
      socketService.leaveRide(rideId);
      setActiveRide(null);
      setDriverLocation(null);
    } finally { setLoading(false); }
  };

  const acceptRide = async (rideId) => {
    setLoading(true);
    try {
      const res  = await rideAPI.acceptRide(rideId);
      const ride = res?.data?.ride ?? res?.ride;
      setActiveRide(ride);
      if (ride?.id) socketService.joinRide(ride.id);
      return ride;
    } finally { setLoading(false); }
  };

  const startRide = async (rideId) => {
    const res  = await rideAPI.startRide(rideId);
    const ride = res?.data?.ride ?? res?.ride;
    if (ride) setActiveRide(ride);
    return ride;
  };

  const completeRide = async (rideId, actualFare) => {
    const res  = await rideAPI.completeRide(rideId, { actualFare, paymentMethod: 'CASH' });
    const ride = res?.data?.ride ?? res?.ride;
    socketService.leaveRide(rideId);
    setActiveRide(null);
    setDriverLocation(null);
    return ride;
  };

  return (
    <RideContext.Provider value={{
      activeRide, driverLocation, loading,
      requestRide, cancelRide, acceptRide, startRide, completeRide,
      refreshActiveRide: loadActiveRide,
    }}>
      {children}
    </RideContext.Provider>
  );
};

// Safe hook — returns empty defaults if called outside provider
export const useRide = () => {
  const ctx = useContext(RideContext);
  if (!ctx) {
    console.warn('[useRide] Called outside RideProvider — add <RideProvider> to App.js');
    return {
      activeRide: null, driverLocation: null, loading: false,
      requestRide: async () => null, cancelRide: async () => {},
      acceptRide: async () => null, startRide: async () => null,
      completeRide: async () => null, refreshActiveRide: async () => {},
    };
  }
  return ctx;
};