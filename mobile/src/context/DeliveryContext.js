// mobile/src/context/DeliveryContext.js
import React, {createContext, useState, useEffect, useContext} from 'react';
import {deliveryAPI} from '../services/api';
import socketService from '../services/socket';

const DeliveryContext = createContext();

export const DeliveryProvider = ({children}) => {
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActiveDelivery();

    const handlePartnerLocation = data => {
      setPartnerLocation({latitude: data.lat, longitude: data.lng});
    };

    socketService.on('partner:location:update', handlePartnerLocation);
    return () =>
      socketService.off('partner:location:update', handlePartnerLocation);
  }, []);

  const loadActiveDelivery = async () => {
    try {
      const res = await deliveryAPI.getActiveDelivery();
      setActiveDelivery(res.data?.delivery ?? null);
    } catch {
      setActiveDelivery(null);
    }
  };

  const requestDelivery = async data => {
    setLoading(true);
    try {
      const res = await deliveryAPI.requestDelivery(data);
      const delivery = res.data.delivery;
      setActiveDelivery(delivery);
      socketService.joinDelivery(delivery.id);
      return delivery;
    } finally {
      setLoading(false);
    }
  };

  const cancelDelivery = async (deliveryId, reason) => {
    setLoading(true);
    try {
      await deliveryAPI.cancelDelivery(deliveryId, {reason});
      socketService.leaveDelivery(deliveryId);
      setActiveDelivery(null);
      setPartnerLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const acceptDelivery = async deliveryId => {
    const res = await deliveryAPI.acceptDelivery(deliveryId);
    setActiveDelivery(res.data.delivery);
  };

  const pickupDelivery = async deliveryId => {
    const res = await deliveryAPI.pickupDelivery(deliveryId);
    setActiveDelivery(res.data.delivery);
  };

  const startTransit = async deliveryId => {
    const res = await deliveryAPI.startTransit(deliveryId);
    setActiveDelivery(res.data.delivery);
  };

  const completeDelivery = async (deliveryId, data) => {
    const res = await deliveryAPI.completeDelivery(deliveryId, data);
    socketService.leaveDelivery(deliveryId);
    setActiveDelivery(null);
    setPartnerLocation(null);
    return res.data.delivery;
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
      }}>
      {children}
    </DeliveryContext.Provider>
  );
};

export const useDelivery = () => useContext(DeliveryContext);