// mobile/src/services/socket.js
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

const SOCKET_URL = API_BASE_URL.replace('/api', '');

class SocketService {
  socket = null;

  // Listeners registered before the socket was ready are queued here
  // and re-attached automatically once connected.
  _pendingListeners = []; // [{ event, callback }]
  _connectCallbacks = []; // callbacks waiting for connection

  async connect() {
    // Already connected — nothing to do
    if (this.socket?.connected) return;

    // Already connecting — wait for it
    if (this.socket && !this.socket.connected) {
      return new Promise((resolve) => {
        this._connectCallbacks.push(resolve);
      });
    }

    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket.id);

      // Re-attach any listeners that were registered before connect finished
      for (const { event, callback } of this._pendingListeners) {
        this.socket.on(event, callback);
      }
      this._pendingListeners = [];

      // Resolve any callers awaiting connection
      for (const cb of this._connectCallbacks) cb();
      this._connectCallbacks = [];
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._pendingListeners = [];
    this._connectCallbacks = [];
  }

  // ── Driver helpers ────────────────────────────────────────────────────────

  goOnline(location) {
    if (!this.socket?.connected) return;
    this.socket.emit('driver:online', {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  goOffline() {
    if (!this.socket?.connected) return;
    this.socket.emit('driver:offline');
  }

  updateLocation(location) {
    if (!this.socket?.connected) return;
    this.socket.emit('driver:location', {
      lat: location.latitude,
      lng: location.longitude,
    });
  }

  // ── Ride room helpers ─────────────────────────────────────────────────────

  joinRide(rideId) {
    if (!this.socket?.connected) return;
    this.socket.emit('ride:join', rideId);
  }

  leaveRide(rideId) {
    if (!this.socket?.connected) return;
    this.socket.emit('ride:leave', rideId);
  }

  // ── Event listener helpers ────────────────────────────────────────────────
  //
  // If the socket is already connected, attach immediately.
  // If not, queue the listener — it will be attached on connect.
  // This eliminates the race condition where useEffect runs before
  // the async connect() has finished.

  on(event, callback) {
    if (this.socket?.connected) {
      this.socket.on(event, callback);
    } else {
      // Queue it — will be attached once connected (or re-connected)
      this._pendingListeners.push({ event, callback });

      // Also attach to the socket object right now even if not connected,
      // so reconnect events are caught without needing to re-queue.
      if (this.socket) {
        this.socket.on(event, callback);
      }
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    // Also remove from the pending queue in case it never attached
    this._pendingListeners = this._pendingListeners.filter(
      (l) => !(l.event === event && l.callback === callback)
    );
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

export default new SocketService();