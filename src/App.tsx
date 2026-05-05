import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

type AppState = 'LOBBY' | 'CREATING' | 'JOINING' | 'IN_ROOM' | 'IN_GAME';
type Player = { id: string; name: string; isAdmin: boolean };
type GameState = {
  phase: 'ANSWERING' | 'PLACING' | 'REVEALING';
  currentQuestion: string;
  answers: Record<string, number>;
  sequence: Player[];
  askerIndex: number;
  score?: number; // NEW
  scoringResults?: Record<string, 'success' | 'failed'>; // NEW
};

// Connect to our backend
const socket: Socket = io('http://localhost:3000');

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [playerName, setPlayerName] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myAnswer, setMyAnswer] = useState<string>('');

  useEffect(() => {
    socket.on('room_updated', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    socket.on('game_started', (initialState: GameState) => {
      setGameState(initialState);
      setAppState('IN_GAME');
      setMyAnswer('');
    });

    socket.on('game_state_updated', (newState: GameState) => {
      setGameState(newState);
      if (newState.phase === 'ANSWERING') {
        setMyAnswer(''); // Clear input for the new round
      }
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_started');
      socket.off('game_state_updated');
    };
  }, []);

  // --- ACTIONS ---

  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    setAppState('CREATING');

    socket.emit('create_room', playerName, (res: any) => {
      if (res.success) {
        setRoomCode(res.roomCode);
        setPlayers(res.players);
        setAppState('IN_ROOM');
      }
    });
  };

  const joinRoom = (code: string) => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    if (!code) return;
    setAppState('JOINING');
    const upperCode = code.toUpperCase();

    socket.emit('join_room', { roomCode: upperCode, playerName }, (res: any) => {
      if (res.success) {
        setRoomCode(upperCode);
        setPlayers(res.players);
        setAppState('IN_ROOM');
      } else {
        alert(res.error || "Failed to join room");
        setAppState('LOBBY');
      }
    });
  };

  const leaveRoom = () => {
    socket.emit('leave_room', roomCode);
    setRoomCode('');
    setJoinInput('');
    setPlayers([]);
    setGameState(null);
    setAppState('LOBBY');
  };

  const startGame = () => socket.emit('start_game', roomCode);
  const nextRound = () => socket.emit('next_round', roomCode);
  const triggerReveal = () => socket.emit('reveal_cards', roomCode);

  const submitAnswer = () => {
    if (!myAnswer) return;
    socket.emit('submit_answer', { roomCode, answer: Number(myAnswer) });
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedPlayerId = e.dataTransfer.getData('text/plain');
    socket.emit('place_tile', { roomCode, draggedPlayerId, targetIndex });
  };

  // --- HELPERS ---

  const me = players.find(p => p.id === socket.id);
  const isAmAdmin = me?.isAdmin || false;

  // --- RENDER FUNCTIONS ---

  const renderLobby = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Enter Your Name"
        style={{ padding: '0.5rem', fontSize: '1rem', textAlign: 'center' }}
      />
      <button
        onClick={createRoom}
        disabled={!playerName.trim()}
        style={{ padding: '1rem', cursor: playerName.trim() ? 'pointer' : 'not-allowed', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
      >
        CREATE ROOM
      </button>

      <div style={{ textAlign: 'center', color: '#666', margin: '0.5rem 0' }}>— OR —</div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={joinInput}
          onChange={(e) => setJoinInput(e.target.value)}
          placeholder="Room Code"
          maxLength={4}
          style={{ padding: '0.5rem', flex: 1, textTransform: 'uppercase', textAlign: 'center' }}
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
  );

  const renderInRoom = () => (
    <div style={{ border: '2px solid #ccc', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
      <h2 style={{ letterSpacing: '2px' }}>Room: {roomCode}</h2>

      <h3 style={{ marginTop: '1.5rem' }}>Players ({players.length}/6):</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
        {players.map((p) => (
          <li key={p.id} style={{ margin: '0.5rem 0', fontSize: '1.1rem' }}>
            {p.name} {p.id === socket.id && '(You)'} {p.isAdmin && '👑'}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isAmAdmin ? (
          <button
            onClick={startGame}
            disabled={players.length < 2}
            style={{ padding: '1rem', cursor: players.length >= 2 ? 'pointer' : 'not-allowed', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem' }}
          >
            {players.length >= 2 ? 'Start Game' : 'Waiting for others...'}
          </button>
        ) : (
          <div style={{ padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', color: '#555' }}>
            Waiting for host to start...
          </div>
        )}
        <button onClick={leaveRoom} style={{ padding: '0.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px' }}>
          Leave Room
        </button>
      </div>
    </div>
  );

  const renderGame = () => {
    if (!gameState) return null;

    const { phase, currentQuestion, answers, sequence, askerIndex, score, scoringResults } = gameState;
    const asker = players[askerIndex];
    
    // Check if socket.id exists first to keep TypeScript happy
    const hasAnswered = socket.id ? answers[socket.id] !== undefined : false;
    
    // Check if my tile is currently placed in the sequence
    const haveIPlacedMyTile = sequence.some(p => p.id === socket.id);
    const allTilesPlaced = sequence.length === players.length;

    return (
      <div style={{ border: '2px solid #2196F3', padding: '1rem', borderRadius: '8px', backgroundColor: '#f3fdf5' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#333' }}>{currentQuestion}</h2>
          
          <div style={{ backgroundColor: '#fff9c4', padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', display: 'inline-block', marginTop: '0.5rem', border: '1px solid #fbc02d' }}>
            🗣️ {asker?.id === socket.id ? "YOU get" : `${asker?.name} gets`} to ask a question!
          </div>
        </div>

        {/* NEW: Team Score Banner */}
        {phase === 'REVEALING' && score !== undefined && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '2px solid #4CAF50' }}>
            <h2 style={{ color: '#2E7D32', margin: 0 }}>Team Score: {score} / {players.length}</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#555', fontWeight: 'bold' }}>
              {score === players.length ? 'Perfect Score! 🎉' : 'Better luck next time!'}
            </p>
          </div>
        )}

        {/* PHASE 1: ANSWERING */}
        {phase === 'ANSWERING' && (
          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            {hasAnswered ? (
              <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>Answer locked. Waiting for others...</p>
            ) : (
              <div>
                <p style={{ marginBottom: '1rem', color: '#666' }}>Secretly lock in your number:</p>
                <input 
                  type="number" 
                  value={myAnswer} 
                  onChange={(e) => setMyAnswer(e.target.value)} 
                  placeholder="0-100" 
                  style={{ padding: '0.75rem', width: '100px', textAlign: 'center', marginRight: '10px', fontSize: '1.2rem' }}
                />
                <button 
                  onClick={submitAnswer} 
                  disabled={!myAnswer}
                  style={{ padding: '0.75rem 1.5rem', cursor: myAnswer ? 'pointer' : 'not-allowed', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
                >
                  Lock In
                </button>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2 & 3: PLACING AND REVEALING */}
        {(phase === 'PLACING' || phase === 'REVEALING') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {phase === 'PLACING' && !haveIPlacedMyTile && (
              <p style={{ fontWeight: 'bold', color: '#1976d2', marginBottom: '0.5rem' }}>Drag your tile to the board!</p>
            )}

            {/* UNPLACED TILE */}
            {phase === 'PLACING' && !haveIPlacedMyTile && (
              <div 
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', socket.id || '')}
                style={{ 
                  backgroundColor: '#2196F3', color: 'white', padding: '1rem 2rem', 
                  borderRadius: '8px', cursor: 'grab', marginBottom: '1.5rem', 
                  fontWeight: 'bold', boxShadow: '0 4px 8px rgba(33, 150, 243, 0.3)',
                  border: '2px solid #1976d2'
                }}
              >
                {me?.name}'s Tile ➔ (Drag Me)
              </div>
            )}

            {/* THE TABLE */}
            <div style={{ width: '100%', backgroundColor: '#e0e0e0', padding: '1rem', borderRadius: '8px', minHeight: '200px' }}>
              
              <div style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Highest Numbers (Top)
              </div>

              {/* Drop Zone 0 (Top of the list) */}
              {phase === 'PLACING' && (
                <div 
                  onDragOver={(e) => e.preventDefault()} 
                  onDrop={(e) => handleDrop(e, 0)}
                  style={{ height: '20px', border: '2px dashed #aaa', margin: '4px 0', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.6)' }}
                />
              )}

              {sequence.map((player, index) => (
                <React.Fragment key={player.id}>
                  {/* PLACED TILE */}
                  {(() => {
                    const result = phase === 'REVEALING' && scoringResults ? scoringResults[player.id] : null;
                    const isFailed = result === 'failed';

                    return (
                      <div 
                        draggable={phase === 'PLACING'}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', player.id)}
                        style={{ 
                          // Turn failed tiles grey
                          backgroundColor: isFailed ? '#9e9e9e' : (player.id === socket.id ? '#2196F3' : '#FF9800'), 
                          color: isFailed ? '#e0e0e0' : 'white', 
                          opacity: isFailed ? 0.8 : 1,
                          padding: '1rem', borderRadius: '8px', margin: '4px 0', 
                          textAlign: 'center', position: 'relative', fontWeight: 'bold',
                          cursor: phase === 'PLACING' ? 'grab' : 'default',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        {/* Cross out the name and add emojis based on success/fail */}
                        <span style={{ textDecoration: isFailed ? 'line-through' : 'none' }}>
                          {player.name} {isFailed && '❌'} {result === 'success' && '✅'}
                        </span>
                        
                        {/* Show the number when in the REVEALING phase */}
                        {phase === 'REVEALING' && (
                          <span style={{ 
                            position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)',
                            fontWeight: 'bold', 
                            backgroundColor: isFailed ? '#ccc' : 'white', 
                            color: isFailed ? '#666' : '#333', 
                            padding: '4px 10px', borderRadius: '12px', fontSize: '1.1rem',
                            textDecoration: isFailed ? 'line-through' : 'none',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
                          }}>
                            {answers[player.id]}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Drop Zone (Below this tile) */}
                  {phase === 'PLACING' && (
                    <div 
                      onDragOver={(e) => e.preventDefault()} 
                      onDrop={(e) => handleDrop(e, index + 1)}
                      style={{ height: '20px', border: '2px dashed #aaa', margin: '4px 0', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.6)' }}
                    />
                  )}
                </React.Fragment>
              ))}

              {sequence.length === 0 && (
                <div style={{ textAlign: 'center', color: '#666', padding: '2rem 0', fontStyle: 'italic' }}>
                  The table is empty. Drag a tile here!
                </div>
              )}

              <div style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Lowest Numbers (Bottom)
              </div>
            </div>

            {/* Admin Controls */}
            {phase === 'PLACING' && isAmAdmin && (
              <button 
                onClick={triggerReveal} 
                disabled={!allTilesPlaced}
                style={{ 
                  marginTop: '1.5rem', padding: '1rem', 
                  backgroundColor: allTilesPlaced ? '#E91E63' : '#ccc', 
                  color: 'white', width: '100%', 
                  cursor: allTilesPlaced ? 'pointer' : 'not-allowed',
                  border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem'
                }}
              >
                {allTilesPlaced ? 'Reveal Cards!' : 'Waiting for everyone to place tiles...'}
              </button>
            )}

            {phase === 'REVEALING' && isAmAdmin && (
              <button 
                onClick={nextRound} 
                style={{ 
                  marginTop: '1.5rem', padding: '1rem', 
                  backgroundColor: '#9C27B0', color: 'white', width: '100%', 
                  border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer'
                }}
              >
                Start Next Round
              </button>
            )}
            
            {phase === 'REVEALING' && !isAmAdmin && (
              <div style={{ marginTop: '1.5rem', color: '#666', fontStyle: 'italic' }}>
                Waiting for host to start the next round...
              </div>
            )}

          </div>
        )}

      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#2E7D32', marginBottom: '2rem' }}>Fun Facts 🌱 </h1>

      {appState === 'LOBBY' && renderLobby()}
      {(appState === 'CREATING' || appState === 'JOINING') && <p style={{ textAlign: 'center' }}>Loading...</p>}
      {appState === 'IN_ROOM' && renderInRoom()}
      {appState === 'IN_GAME' && renderGame()}
    </div>
  );
}