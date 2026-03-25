import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { AppState } from "react-native";
import config from "../config/config";
import { io } from "socket.io-client";

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  emit: () => {},
  on: () => {},
  off: () => {},
  reconnect: () => {},
});

export const SocketProvider = ({ children, userId, userRole, authToken }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log("[SocketContext] Already connected");
      return;
    }

    if (!userId || !authToken) {
      console.log(
        "[SocketContext] Missing userId or authToken - skipping connection",
      );
      return;
    }

    console.log("[SocketContext] Connecting to socket server...", {
      url: config.API_URL,
      userId,
      userRole,
    });

    try {
      // Create socket connection with auth
      const newSocket = io(config.API_URL, {
        auth: {
          token: authToken,
        },
        query: { userId, userRole },
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: config.SOCKET_RECONNECT_INTERVAL,
        reconnectionDelayMax: config.SOCKET_RECONNECT_INTERVAL * 2,
        reconnectionAttempts: config.SOCKET_MAX_RETRIES,
        timeout: 10000,
      });

      socketRef.current = newSocket;

      newSocket.on("connect", () => {
        console.log("[SocketContext] ✅ Connected to socket server");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Register based on role
        if (userRole === "driver") {
          newSocket.emit("driver:register", userId);
          console.log("[SocketContext] Registered as driver:", userId);
        } else if (userRole === "customer") {
          newSocket.emit("customer:register", userId);
          console.log("[SocketContext] Registered as customer:", userId);
        } else if (userRole === "admin") {
          newSocket.emit("admin:register", userId);
          console.log("[SocketContext] Registered as admin:", userId);
        } else if (userRole === "manager") {
          newSocket.emit("manager:register", userId);
          console.log("[SocketContext] Registered as manager:", userId);
        }
      });

      newSocket.on("disconnect", (reason) => {
        console.log("[SocketContext] ❌ Disconnected:", reason);
        setIsConnected(false);

        // Auto-reconnect on unexpected disconnect
        if (reason === "io server disconnect") {
          // Server forced disconnect - reconnect manually
          setTimeout(() => {
            if (reconnectAttemptsRef.current < config.SOCKET_MAX_RETRIES) {
              console.log("[SocketContext] Attempting reconnection...");
              reconnectAttemptsRef.current++;
              newSocket.connect();
            }
          }, config.SOCKET_RECONNECT_INTERVAL);
        }
      });

      newSocket.on("connect_error", (error) => {
        console.error("[SocketContext] Connection error:", error.message);
        setIsConnected(false);
      });

      // Acknowledgement handlers
      newSocket.on("driver:registered", (data) => {
        console.log("[SocketContext] Driver registration confirmed:", data);
      });

      newSocket.on("customer:registered", (data) => {
        console.log("[SocketContext] Customer registration confirmed:", data);
      });

      newSocket.on("admin:registered", (data) => {
        console.log("[SocketContext] Admin registration confirmed:", data);
      });

      newSocket.on("manager:registered", (data) => {
        console.log("[SocketContext] Manager registration confirmed:", data);
      });
    } catch (error) {
      console.error("[SocketContext] Failed to initialize socket:", error);
    }
  }, [userId, userRole, authToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      // Notify server we're going offline based on role
      if (userRole === "driver") {
        socketRef.current.emit("driver:offline", userId);
      } else if (userRole === "customer") {
        socketRef.current.emit("customer:offline", userId);
      } else if (userRole === "admin") {
        socketRef.current.emit("admin:offline", userId);
      } else if (userRole === "manager") {
        socketRef.current.emit("manager:offline", userId);
      }

      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
  }, [userId, userRole]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
      console.log("[SocketContext] Emitted event:", event, data);
    } else {
      console.warn("[SocketContext] Cannot emit - not connected:", event);
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      console.log("[SocketContext] Registered listener for:", event);
    }
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
      console.log("[SocketContext] Removed listener for:", event);
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  }, [connect, disconnect]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && userId) {
        if (!socketRef.current?.connected) {
          connect();
        }
      } else if (nextAppState === "background") {
        // Keep connection alive for drivers to receive deliveries in background
        if (userRole !== "driver") {
          disconnect();
        }
      }
    });

    return () => subscription?.remove();
  }, [userId, userRole, connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    if (userId && authToken) {
      connect();
    }
    return () => disconnect();
  }, [userId, authToken, connect, disconnect]);

  const value = {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
    off,
    reconnect,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

export default SocketContext;
