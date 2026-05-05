import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

type AppState = 'LOBBY' | 'CREATING' | 'JOINING' | 'IN_ROOM' | 'IN_GAME';
type Player = { id: string; name: string; isAdmin: boolean };
type GameState = {
  phase: 'ANSWERING' | 'PLACING' | 'REVEALING';
  currentQuestion: string;
  answers: Record<string, number>;
  sequence: Player[];
  unplacedPlayers: Player[];
  askerIndex: number;
};

const socket: Socket = io('http://localhost:3000');

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [playerName, setPlayerName] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // New Game State hooks
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myAnswer, setMyAnswer] = useState<string>('');

  useEffect(() => {
    socket.on('room_updated', (updatedPlayers: Player[]) => setPlayers(updatedPlayers));
    
    socket.on('game_started', (initialState: GameState) => {
      setGameState(initialState);
      setAppState('IN_GAME');
      setMyAnswer('');
    });

    socket.on('game_state_updated', (newState: GameState) => {
      setGameState(newState);
      if (newState.phase === 'ANSWERING') setMyAnswer(''); // Reset input on new round
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_started');
      socket.off('game_state_updated');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    setAppState('CREATING');
    setIsProcessing(true);
    socket.emit('create_room', playerName, (res: any) => {
      if (res.success) {
        setRoomCode(res.roomCode);
        setPlayers(res.players);
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
    socket.emit('join_room', { roomCode: upperCode, playerName }, (res: any) => {
      setIsProcessing(false);
      if (res.success) {
        setRoomCode(upperCode);
        setPlayers(res.players);
        setAppState('IN_ROOM');
      } else {
        alert(res.error);
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

  const submitAnswer = () => {
    if (!myAnswer) return;
    socket.emit('submit_answer', { roomCode, answer: Number(myAnswer) });
  };

  const placeTile = (targetIndex: number) => {
    socket.emit('place_tile', { roomCode, targetIndex });
  };

  const me = players.find(p => p.id === socket.id);
  const isAmAdmin = me?.isAdmin || false;

  // --- RENDER HELPERS ---

  const renderLobby = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <input 
        value={playerName} onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Enter Your Name" style={{ padding: '0.5rem', fontSize: '1rem' }}
      />
      <button onClick={createRoom} disabled={!playerName.trim()} style={{ padding: '1rem' }}>CREATE ROOM</button>
      <hr style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Room Code" maxLength={4} style={{ padding: '0.5rem', flex: 1, textTransform: 'uppercase' }}/>
        <button onClick={() => joinRoom(joinInput)} disabled={joinInput.length === 0 || !playerName.trim()} style={{ padding: '0.5rem' }}>JOIN</button>
      </div>
    </div>
  );

  const renderInRoom = () => (
    <div style={{ border: '2px solid #ccc', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
      <h2>Room: {roomCode}</h2>
      <h3>Players ({players.length}/6):</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map((p) => <li key={p.id}>{p.name} {p.id === socket.id && '(You)'} {p.isAdmin && '👑'}</li>)}
      </ul>
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isAmAdmin ? (
          <button onClick={startGame} disabled={players.length < 2} style={{ padding: '1rem', backgroundColor: '#4CAF50', color: 'white' }}>
            {players.length >= 2 ? 'Start Game' : 'Waiting for others...'}
          </button>
        ) : (
          <p>Waiting for host to start...</p>
        )}
      </div>
    </div>
  );

  const renderGame = () => {
    if (!gameState) return null;

    const { phase, currentQuestion, answers, sequence, unplacedPlayers, askerIndex } = gameState;
    const asker = players[askerIndex];
    const isMyTurnToPlace = phase === 'PLACING' && unplacedPlayers.length > 0 && unplacedPlayers[0].id === socket.id;
    const hasAnswered = answers[socket.id] !== undefined;

    return (
      <div style={{ border: '2px solid #2196F3', padding: '1rem', borderRadius: '8px', backgroundColor: '#f3fdf5' }}>
        
        {/* TOP: Question & Vibe Check Announcer */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#333' }}>{currentQuestion}</h2>
          <div style={{ backgroundColor: '#fff9c4', padding: '0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
            🗣️ {asker.id === socket.id ? "YOU" : asker.name} gets to ask a question to the group!
          </div>
        </div>

        {/* PHASE 1: ANSWERING */}
        {phase === 'ANSWERING' && (
          <div style={{ textAlign: 'center' }}>
            {hasAnswered ? (
              <p>Waiting for others to answer...</p>
            ) : (
              <div>
                <input 
                  type="number" value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)} 
                  placeholder="Your secret number" style={{ padding: '0.5rem', width: '100px', textAlign: 'center', marginRight: '10px' }}
                />
                <button onClick={submitAnswer} style={{ padding: '0.5rem' }}>Lock In</button>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2 & 3: PLACING AND REVEALING (The Table) */}
        {(phase === 'PLACING' || phase === 'REVEALING') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {phase === 'PLACING' && (
              <p style={{ fontWeight: 'bold', color: '#1976d2' }}>
                {isMyTurnToPlace ? "IT IS YOUR TURN! Drag your tile." : `Waiting for ${unplacedPlayers[0].name} to place...`}
              </p>
            )}

            {/* If it's my turn, show my draggable tile */}
            {isMyTurnToPlace && (
              <div 
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', socket.id)}
                style={{ backgroundColor: '#2196F3', color: 'white', padding: '1rem 2rem', borderRadius: '8px', cursor: 'grab', marginBottom: '1rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              >
                {me?.name}'s Arrow ➔ (Drag Me!)
              </div>
            )}

            {/* THE TABLE / SEQUENCE */}
            <div style={{ width: '100%', backgroundColor: '#e0e0e0', padding: '1rem', borderRadius: '8px', minHeight: '150px' }}>
              
              {/* Drop Zone 0 (Top) */}
              {phase === 'PLACING' && isMyTurnToPlace && (
                <div 
                  onDragOver={(e) => e.preventDefault()} 
                  onDrop={() => placeTile(0)}
                  style={{ height: '30px', border: '2px dashed #999', margin: '4px 0', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.5)' }}
                />
              )}

              {sequence.map((player, index) => (
                <React.Fragment key={player.id}>
                  {/* Placed Tile */}
                  <div style={{ 
                    backgroundColor: player.id === socket.id ? '#2196F3' : '#FF9800', 
                    color: 'white', padding: '1rem', borderRadius: '8px', margin: '4px 0', textAlign: 'center', position: 'relative'
                  }}>
                    {player.name}
                    {phase === 'REVEALING' && (
                      <span style={{ position: 'absolute', right: '10px', fontWeight: 'bold', backgroundColor: 'white', color: 'black', padding: '2px 8px', borderRadius: '12px' }}>
                        {answers[player.id]}
                      </span>
                    )}
                  </div>

                  {/* Drop Zone (After this tile) */}
                  {phase === 'PLACING' && isMyTurnToPlace && (
                    <div 
                      onDragOver={(e) => e.preventDefault()} 
                      onDrop={() => placeTile(index + 1)}
                      style={{ height: '30px', border: '2px dashed #999', margin: '4px 0', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.5)' }}
                    />
                  )}
                </React.Fragment>
              ))}

              {sequence.length === 0 && <p style={{ textAlign: 'center', color: '#666' }}>Table is empty. Place the first tile!</p>}
            </div>

            {/* Next Round Button for Admin */}
            {phase === 'REVEALING' && isAmAdmin && (
              <button onClick={nextRound} style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#9C27B0', color: 'white', width: '100%' }}>
                Start Next Round
              </button>
            )}

          </div>
        )}

      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1>🌱 Vibe Game</h1>
      {appState === 'LOBBY' && renderLobby()}
      {(appState === 'CREATING' || appState === 'JOINING') && <p>Loading...</p>}
      {appState === 'IN_ROOM' && renderInRoom()}
      {appState === 'IN_GAME' && renderGame()}
    </div>
  );
}