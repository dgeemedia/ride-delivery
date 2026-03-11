// mobile/src/services/socket.js
import {io} from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/constants';

const SOCKET_URL = API_BASE_URL.replace('/api', '');

class SocketService {
  socket = null;

  async connect() {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    this.socket = io(SOCKET_URL, {
      auth: {token},
      transports: ['websocket'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

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

  updateLocation(location) {
    if (!this.socket) return;
    this.socket.emit('driver:location', {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }
}

export default new SocketService();