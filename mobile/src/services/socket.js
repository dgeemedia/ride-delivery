import { io } from 'socket.io-client';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  socket = null;
  listeners = new Map();

  async connect() {
    const token = await AsyncStorage.getItem('authToken');
    
    if (!token) {
      console.log('No auth token, cannot connect socket');
      return;
    }

    const baseURL = Config.API_BASE_URL?.replace('/api', '') || 'http://localhost:3000';

    this.socket = io(baseURL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Driver methods
  goOnline(location) {
    if (!this.socket) return;
    this.socket.emit('driver:online', {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  goOffline() {
    if (!this.socket) return;
    this.socket.emit('driver:offline');
  }

  updateDriverLocation(location) {
    if (!this.socket) return;
    this.socket.emit('driver:location', {
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
    });
  }

  // Delivery partner methods
  goOnlinePartner(location) {
    if (!this.socket) return;
    this.socket.emit('partner:online', {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  updatePartnerLocation(location) {
    if (!this.socket) return;
    this.socket.emit('partner:location', {
      lat: location.latitude,
      lng: location.longitude,
      heading: location.heading,
    });
  }

  // Listen to events
  on(event, callback) {
    if (!this.socket) return;
    
    this.socket.on(event, callback);
    
    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (!this.socket) return;
    
    this.socket.off(event, callback);
    
    // Remove from stored listeners
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // FUTURE: Add chat functionality
  // sendMessage(rideId, message) {
  //   if (!this.socket) return;
  //   this.socket.emit('message:send', { rideId, message });
  // }

  // FUTURE: Add emergency SOS
  // triggerEmergency(location) {
  //   if (!this.socket) return;
  //   this.socket.emit('emergency:trigger', {
  //     lat: location.latitude,
  //     lng: location.longitude,
  //   });
  // }
}

export default new SocketService();