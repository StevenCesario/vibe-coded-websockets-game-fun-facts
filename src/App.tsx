import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

type AppState = 'LOBBY' | 'CREATING' | 'JOINING' | 'IN_ROOM';
type Player = { id: string; name: string };

const socket: Socket = io('http://localhost:3000');

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [playerName, setPlayerName] = useState<string>(''); // NEW: Track the user's name
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]); // NEW: Track list of players

  useEffect(() => {
    // Listen for ANY updates to the room's roster (joins or leaves)
    socket.on('room_updated', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off('room_updated');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    
    setAppState('CREATING');
    setIsProcessing(true);
    
    // Pass playerName to the server
    socket.emit('create_room', playerName, (response: { success: boolean, roomCode: string, players: Player[] }) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setPlayers(response.players); // Set initial roster
        setIsProcessing(false);
        setAppState('IN_ROOM');
      }
    });
  };

  const joinRoom = (code: string) => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    if (!code) return;
    
    setAppState('JOINING');
    setIsProcessing(true);

    const upperCode = code.toUpperCase();

    // Pass an object containing both the room code and their name
    socket.emit('join_room', { roomCode: upperCode, playerName }, (response: { success: boolean, error?: string, players?: Player[] }) => {
      setIsProcessing(false);
      
      if (response.success && response.players) {
        setRoomCode(upperCode);
        setPlayers(response.players); // Set initial roster for the joiner
        setAppState('IN_ROOM');
      } else {
        alert(response.error || "Failed to join room");
        setAppState('LOBBY');
      }
    });
  };

  const leaveRoom = () => {
    socket.emit('leave_room', roomCode); // Tell server we are leaving
    setRoomCode('');
    setJoinInput('');
    setPlayers([]);
    setAppState('LOBBY');
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1>🌱 Vibe Game</h1>

      {appState === 'LOBBY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <input 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter Your Name"
            style={{ padding: '0.5rem', fontSize: '1rem' }}
          />

          <button 
            onClick={createRoom} 
            disabled={!playerName.trim()}
            style={{ padding: '1rem', cursor: playerName.trim() ? 'pointer' : 'not-allowed' }}
          >
            CREATE ROOM
          </button>
          
          <hr style={{ width: '100%' }} />
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Room Code"
              maxLength={4}
              style={{ padding: '0.5rem', flex: 1, textTransform: 'uppercase' }}
            />
            <button 
              onClick={() => joinRoom(joinInput)}
              disabled={joinInput.length === 0 || !playerName.trim()}
              style={{ padding: '0.5rem', cursor: (joinInput.length && playerName.trim()) ? 'pointer' : 'not-allowed' }}
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
          
          <h3>Players:</h3>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {players.map((player) => (
              <li key={player.id}>
                {player.name} {player.id === socket.id ? '(You)' : ''}
              </li>
            ))}
          </ul>
          
          <button onClick={leaveRoom} style={{ marginTop: '2rem', padding: '0.5rem', cursor: 'pointer', width: '100%' }}>
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}