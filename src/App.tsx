import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// NEW: Added 'IN_GAME' state
type AppState = 'LOBBY' | 'CREATING' | 'JOINING' | 'IN_ROOM' | 'IN_GAME';
// NEW: Added isAdmin to the Player type
type Player = { id: string; name: string; isAdmin: boolean };

const socket: Socket = io('http://localhost:3000');

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [playerName, setPlayerName] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    socket.on('room_updated', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    // NEW: Listen for the signal that the admin started the game
    socket.on('game_started', () => {
      setAppState('IN_GAME');
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_started');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    setAppState('CREATING');
    setIsProcessing(true);
    
    socket.emit('create_room', playerName, (response: { success: boolean, roomCode: string, players: Player[] }) => {
      if (response.success) {
        setRoomCode(response.roomCode);
        setPlayers(response.players);
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

    socket.emit('join_room', { roomCode: upperCode, playerName }, (response: { success: boolean, error?: string, players?: Player[] }) => {
      setIsProcessing(false);
      if (response.success && response.players) {
        setRoomCode(upperCode);
        setPlayers(response.players);
        setAppState('IN_ROOM');
      } else {
        alert(response.error || "Failed to join room");
        setAppState('LOBBY');
      }
    });
  };

  // NEW: Emit the start game event
  const startGame = () => {
    socket.emit('start_game', roomCode);
  };

  const leaveRoom = () => {
    socket.emit('leave_room', roomCode);
    setRoomCode('');
    setJoinInput('');
    setPlayers([]);
    setAppState('LOBBY');
  };

  // Find out if the current user is the admin
  const me = players.find(p => p.id === socket.id);
  const isAmAdmin = me?.isAdmin || false;

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
          
          <h3>Players ({players.length}/6):</h3>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {players.map((player) => (
              <li key={player.id}>
                {player.name} {player.id === socket.id && '(You)'} {player.isAdmin && '👑'}
              </li>
            ))}
          </ul>
          
          {/* NEW: Admin Controls vs Guest View */}
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isAmAdmin ? (
              <button 
                onClick={startGame} 
                disabled={players.length < 2}
                style={{ padding: '0.75rem', cursor: players.length >= 2 ? 'pointer' : 'not-allowed', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
              >
                {players.length >= 2 ? 'Start Game' : 'Waiting for others...'}
              </button>
            ) : (
              <div style={{ padding: '0.75rem', textAlign: 'center', backgroundColor: '#f0f0f0', borderRadius: '4px', color: '#555' }}>
                Waiting for host to start...
              </div>
            )}

            <button onClick={leaveRoom} style={{ padding: '0.5rem', cursor: 'pointer' }}>
              Leave Room
            </button>
          </div>
        </div>
      )}

      {/* NEW: Game State */}
      {appState === 'IN_GAME' && (
        <div style={{ border: '2px solid #4CAF50', padding: '1rem', borderRadius: '8px', backgroundColor: '#e8f5e9' }}>
          <h2>🎮 Game in Progress!</h2>
          <p><strong>Room:</strong> {roomCode}</p>
          
          <h3>Playing:</h3>
          <ul>
            {players.map((player) => (
              <li key={player.id}>{player.name} {player.isAdmin && '👑'}</li>
            ))}
          </ul>
          
          <button onClick={leaveRoom} style={{ marginTop: '2rem', padding: '0.5rem', cursor: 'pointer', width: '100%' }}>
            Leave Game
          </button>
        </div>
      )}
    </div>
  );
}