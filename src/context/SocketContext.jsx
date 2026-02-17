import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import config from '../config/config';

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  emit: () => {},
  on: () => {},
  off: () => {},
  reconnect: () => {},
});

export const SocketProvider = ({ children, userId, userRole }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const connect = useCallback(() => {
    // TODO: Initialize socket.io-client or Supabase Realtime connection
    // Example with socket.io:
    // const newSocket = io(config.API_URL, {
    //   query: { userId, userRole },
    //   transports: ['websocket'],
    //   reconnection: true,
    //   reconnectionDelay: config.SOCKET_RECONNECT_INTERVAL,
    // });
    // socketRef.current = newSocket;
    // newSocket.on('connect', () => setIsConnected(true));
    // newSocket.on('disconnect', () => setIsConnected(false));

    console.log('[SocketContext] Socket connection placeholder - implement with your backend');
  }, [userId, userRole]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect?.();
      socketRef.current = null;
    }
    setIsConnected(false);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on?.(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off?.(event, handler);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && userId) {
        connect();
      } else if (nextAppState === 'background') {
        // Keep connection alive for drivers
        if (userRole !== 'driver') {
          disconnect();
        }
      }
    });

    return () => subscription?.remove();
  }, [userId, userRole, connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    if (userId) {
      connect();
    }
    return () => disconnect();
  }, [userId, connect, disconnect]);

  const value = {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
    off,
    reconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

export default SocketContext;
