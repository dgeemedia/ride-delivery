// mobile/src/context/RideContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { rideAPI } from '../services/api';
import socketService from '../services/socket';

const RideContext = createContext();

export const RideProvider = ({ children }) => {
  const [activeRide,      setActiveRide]      = useState(null);
  const [driverLocation,  setDriverLocation]  = useState(null);
  const [loading,         setLoading]         = useState(false);

  useEffect(() => {
    // 1. Load any active ride from the server on mount
    loadActiveRide();

    // 2. Register location listener BEFORE connecting so it's queued
    //    and attached as soon as the socket handshake completes.
    const handleDriverLocation = (data) => {
      setDriverLocation({
        latitude:  data.lat,
        longitude: data.lng,
        heading:   data.heading ?? null,
      });
    };

    socketService.on('driver:location:update', handleDriverLocation);

    // 3. Ensure the socket is connected. If the driver/customer app already
    //    called connect() earlier (e.g. in AuthContext or a screen), this is
    //    a no-op. If not, it initiates the connection so the queued listener
    //    gets attached once the handshake completes.
    socketService.connect().catch((err) => {
      console.warn('[RideContext] socket connect error:', err?.message);
    });

    return () => {
      socketService.off('driver:location:update', handleDriverLocation);
    };
  }, []);

  // ── Load active ride ────────────────────────────────────────────────────────
  const loadActiveRide = async () => {
    try {
      const res = await rideAPI.getActiveRide();
      const ride = res?.data?.ride ?? res?.ride ?? null;
      setActiveRide(ride);

      // If there's an active ride, join its socket room so status updates arrive
      if (ride?.id) {
        socketService.joinRide(ride.id);
      }
    } catch {
      setActiveRide(null);
    }
  };

  // ── Request ride (generic — not used by the targeted driver flow) ───────────
  const requestRide = async (rideData) => {
    setLoading(true);
    try {
      const res  = await rideAPI.requestRide(rideData);
      const ride = res?.data?.ride ?? res?.ride;
      setActiveRide(ride);
      if (ride?.id) socketService.joinRide(ride.id);
      return ride;
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel ride ─────────────────────────────────────────────────────────────
  const cancelRide = async (rideId, reason) => {
    setLoading(true);
    try {
      await rideAPI.cancelRide(rideId, { reason });
      socketService.leaveRide(rideId);
      setActiveRide(null);
      setDriverLocation(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Accept ride (driver) ────────────────────────────────────────────────────
  const acceptRide = async (rideId) => {
    setLoading(true);
    try {
      const res  = await rideAPI.acceptRide(rideId);
      const ride = res?.data?.ride ?? res?.ride;
      setActiveRide(ride);
      if (ride?.id) socketService.joinRide(ride.id);
      return ride;
    } finally {
      setLoading(false);
    }
  };

  // ── Start ride (driver) ─────────────────────────────────────────────────────
  const startRide = async (rideId) => {
    const res  = await rideAPI.startRide(rideId);
    const ride = res?.data?.ride ?? res?.ride;
    setActiveRide(ride);
    return ride;
  };

  // ── Complete ride (driver) ──────────────────────────────────────────────────
  const completeRide = async (rideId, actualFare) => {
    const res  = await rideAPI.completeRide(rideId, { actualFare });
    const ride = res?.data?.ride ?? res?.ride;
    socketService.leaveRide(rideId);
    setActiveRide(null);
    setDriverLocation(null);
    return ride;
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