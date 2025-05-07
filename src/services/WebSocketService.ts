/**
 * WebSocketService.ts
 * A singleton service for managing WebSocket connections
 */

import { EventEmitter } from 'events';

type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

// Define the WebSocket message interface
interface WSMessage {
  type: string;
  [key: string]: any;
}

class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'closed';
  private url: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private manualClose = false;
  private debug = false;

  private constructor() {
    super();
    // This is a singleton - initialize the event emitter
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Enable or disable debug logging
   */
  public setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Log messages when debug is enabled
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[WebSocketService]', ...args);
    }
  }

  /**
   * Get the current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(url: string): void {
    // Don't reconnect if already connected to the same URL
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.url === url) {
      this.log('Already connected to', url);
      return;
    }

    // Close any existing connection
    this.disconnect();

    this.url = url;
    this.manualClose = false;
    this.reconnectAttempts = 0;
    
    this.log('Connecting to', url);
    this.createConnection();
  }

  /**
   * Create the WebSocket connection with event handlers
   */
  private createConnection(): void {
    if (!this.url) return;

    try {
      this.status = 'connecting';
      this.emit('statusChange', this.status);
      
      this.ws = new WebSocket(this.url);
      
      // Connection opened
      this.ws.onopen = (event) => {
        this.log('Connection opened');
        this.status = 'open';
        this.reconnectAttempts = 0;
        this.emit('statusChange', this.status);
        this.emit('open', event);
      };
      
      // Connection error
      this.ws.onerror = (event) => {
        this.log('Connection error', event);
        this.status = 'error';
        this.emit('statusChange', this.status);
        this.emit('error', event);
      };
      
      // Connection closed
      this.ws.onclose = (event) => {
        this.log('Connection closed', event.code, event.reason);
        this.status = 'closed';
        this.emit('statusChange', this.status);
        this.emit('close', event);
        
        // Clean up
        this.ws = null;
        
        // Attempt to reconnect unless manually closed
        if (!this.manualClose) {
          this.scheduleReconnect();
        }
      };
      
      // Message received
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.log('Message received', data);
          this.emit('message', data);
        } catch (error) {
          this.log('Error parsing message', error);
          this.emit('error', new Error('Invalid message format'));
        }
      };
      
    } catch (error) {
      this.log('Error creating WebSocket', error);
      this.status = 'error';
      this.emit('statusChange', this.status);
      this.emit('error', error);
      
      // Try to reconnect on connection error
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Maximum reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => this.createConnection(), delay);
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    this.manualClose = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      try {
        this.ws.close(1000, 'Normal closure');
      } catch (error) {
        this.log('Error closing WebSocket', error);
      }
      this.ws = null;
    }
    
    this.status = 'closed';
    this.emit('statusChange', this.status);
  }

  /**
   * Send a message to the WebSocket server
   */
  public send(data: WSMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('Cannot send message - connection not open');
      return false;
    }
    
    try {
      const message = JSON.stringify(data);
      this.ws.send(message);
      this.log('Message sent', data);
      return true;
    } catch (error) {
      this.log('Error sending message', error);
      return false;
    }
  }
}

// Export the singleton instance
export default WebSocketService.getInstance();
