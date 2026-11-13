import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

class SocketClient {
  private static instance: Socket | null = null;

  public static getInstance(): Socket {
    if (!SocketClient.instance) {
      SocketClient.instance = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
      });
    }
    return SocketClient.instance;
  }
}

export const socket = SocketClient.getInstance();