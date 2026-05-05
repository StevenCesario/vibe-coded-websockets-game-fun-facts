import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

type AppState = 'LOBBY' | 'CREATING' | 'JOINING' | 'IN_ROOM';

// Connect to our new backend
const socket: Socket = io('http://localhost:3000');

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [playerCount, setPlayerCount] = useState<number>(1);

  useEffect(() => {
    // Listen for other players joining our room
    socket.on('player_joined', (data) => {
      console.log('Another player joined!', data);
      setPlayerCount((prev) => prev + 1);
    });

    return () => {
      socket.off('player_joined');
    };
  }, []);

  const createRoom = () => {
    setAppState('CREATING');
    setIsProcessing(true);
    
    // Ask the server to create a room
    socket.emit('create_room', (response: { success: boolean, roomCode: string }) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setPlayerCount(1);
        setIsProcessing(false);
        setAppState('IN_ROOM');
      }
    });
  };

  const joinRoom = (code: string) => {
    if (!code) return;
    setAppState('JOINING');
    setIsProcessing(true);

    const upperCode = code.toUpperCase();

    // Ask the server to join this specific room
    socket.emit('join_room', upperCode, (response: { success: boolean, error?: string }) => {
      setIsProcessing(false);
      
      if (response.success) {
        setRoomCode(upperCode);
        setAppState('IN_ROOM');
        // If we joined, we know there are at least 2 people (the creator + us)
        setPlayerCount(2); 
      } else {
        alert(response.error || "Failed to join room");
        setAppState('LOBBY');
      }
    });
  };

  const leaveRoom = () => {
    setRoomCode('');
    setJoinInput('');
    setPlayerCount(1);
    setAppState('LOBBY');
    // For a real app, you'd want to emit a 'leave_room' event here too!
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1>🌱 Vibe Game</h1>

      {appState === 'LOBBY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={createRoom} style={{ padding: '1rem', cursor: 'pointer' }}>
            CREATE ROOM
          </button>
          
          <hr style={{ width: '100%' }} />
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Enter Room Code"
              maxLength={4}
              style={{ padding: '0.5rem', flex: 1, textTransform: 'uppercase' }}
            />
            <button 
              onClick={() => joinRoom(joinInput)}
              disabled={joinInput.length === 0}
              style={{ padding: '0.5rem', cursor: joinInput.length ? 'pointer' : 'not-allowed' }}
            >
              JOIN ROOM
            </button>
          </div>
        </div>
      )}

      {(appState === 'CREATING' || appState === 'JOINING') && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>{isProcessing ? 'Communicating with server...' : 'Loading...'}</p>
        </div>
      )}

      {appState === 'IN_ROOM' && (
        <div style={{ border: '2px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
          <h2>Room: {roomCode}</h2>
          <p>Players in room: {playerCount}</p>
          
          <button onClick={leaveRoom} style={{ marginTop: '2rem', padding: '0.5rem', cursor: 'pointer' }}>
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}