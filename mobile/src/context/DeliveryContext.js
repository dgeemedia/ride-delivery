import React, { createContext, useState, useEffect, useContext } from 'react';
import { deliveryAPI } from '../services/api';
import socketService from '../services/socket';

const DeliveryContext = createContext();

export const DeliveryProvider = ({ children }) => {
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);

  useEffect(() => {
    loadActiveDelivery();
    
    socketService.on('partner:location:update', handlePartnerLocationUpdate);

    return () => {
      socketService.off('partner:location:update');
    };
  }, []);

  const loadActiveDelivery = async () => {
    try {
      const response = await deliveryAPI.getActiveDelivery();
      setActiveDelivery(response.data.delivery);
    } catch (error) {
      console.log('No active delivery');
    }
  };

  const handlePartnerLocationUpdate = (data) => {
    setPartnerLocation({
      latitude: data.lat,
      longitude: data.lng,
    });
  };

  const requestDelivery = async (deliveryData) => {
    setLoading(true);
    try {
      const response = await deliveryAPI.requestDelivery(deliveryData);
      setActiveDelivery(response.data.delivery);
      return response.data.delivery;
    } finally {
      setLoading(false);
    }
  };

  const cancelDelivery = async (deliveryId, reason) => {
    setLoading(true);
    try {
      await deliveryAPI.cancelDelivery(deliveryId, { reason });
      setActiveDelivery(null);
      setPartnerLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const acceptDelivery = async (deliveryId) => {
    const response = await deliveryAPI.acceptDelivery(deliveryId);
    setActiveDelivery(response.data.delivery);
  };

  const pickupDelivery = async (deliveryId) => {
    const response = await deliveryAPI.pickupDelivery(deliveryId);
    setActiveDelivery(response.data.delivery);
  };

  const startTransit = async (deliveryId) => {
    const response = await deliveryAPI.startTransit(deliveryId);
    setActiveDelivery(response.data.delivery);
  };

  const completeDelivery = async (deliveryId, data) => {
    const response = await deliveryAPI.completeDelivery(deliveryId, data);
    setActiveDelivery(null);
    setPartnerLocation(null);
    return response.data.delivery;
  };

  return (
    <DeliveryContext.Provider
      value={{
        activeDelivery,
        partnerLocation,
        loading,
        requestDelivery,
        cancelDelivery,
        acceptDelivery,
        pickupDelivery,
        startTransit,
        completeDelivery,
        refreshActiveDelivery: loadActiveDelivery,
      }}
    >
      {children}
    </DeliveryContext.Provider>
  );
};

export const useDelivery = () => useContext(DeliveryContext);