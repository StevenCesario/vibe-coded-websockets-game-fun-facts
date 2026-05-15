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
  score?: number;
  scoringResults?: Record<string, 'success' | 'failed'>;
};

const socket: Socket = io('https://game-server-4l6f.onrender.com');

// Vibrant colors matching the board game tiles
const tileColors = ['#FF4F79', '#FFD13B', '#00B388', '#00A6ED', '#9D4EDD', '#FF9800'];

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [playerName, setPlayerName] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myAnswer, setMyAnswer] = useState<string>('');

  useEffect(() => {
    socket.on('room_updated', setPlayers);
    socket.on('game_started', (initialState: GameState) => {
      setGameState(initialState);
      setAppState('IN_GAME');
      setMyAnswer('');
    });
    socket.on('game_state_updated', setGameState);

    // NEW: Listen for sudden disconnects
    socket.on('disconnect', () => {
      alert("Lost connection to the game server! The server may have restarted.");
      setAppState('LOBBY');
      setRoomCode('');
      setPlayers([]);
      setGameState(null);
    });

    return () => {
      socket.off('room_updated'); 
      socket.off('game_started'); 
      socket.off('game_state_updated');
      socket.off('disconnect');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter a name first!");
    setAppState('CREATING');
    socket.emit('create_room', playerName, (res: any) => {
      if (res.success) {
        setRoomCode(res.roomCode); setPlayers(res.players); setAppState('IN_ROOM');
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
        setRoomCode(upperCode); setPlayers(res.players); setAppState('IN_ROOM');
      } else {
        alert(res.error || "Failed to join room"); setAppState('LOBBY');
      }
    });
  };

  const leaveRoom = () => {
    socket.emit('leave_room', roomCode);
    setRoomCode(''); setJoinInput(''); setPlayers([]); setGameState(null); setAppState('LOBBY');
  };

  const startGame = () => socket.emit('start_game', roomCode);
  const nextRound = () => socket.emit('next_round', roomCode);
  const triggerReveal = () => socket.emit('reveal_cards', roomCode);

  const submitAnswer = () => {
    if (!myAnswer) return;
    socket.emit('submit_answer', { roomCode, answer: Number(myAnswer) });
    setMyAnswer('');
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedPlayerId = e.dataTransfer.getData('text/plain');
    socket.emit('place_tile', { roomCode, draggedPlayerId, targetIndex });
  };

  const me = players.find(p => p.id === socket.id);
  const isAmAdmin = me?.isAdmin || false;

  const renderLobby = () => (
    <div className="panel">
      <input 
        value={playerName} onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Enter Your Name" style={{ textAlign: 'center' }}
      />
      <button className="btn-primary" onClick={createRoom} disabled={!playerName.trim()}>
        CREATE ROOM
      </button>
      
      <div style={{ textAlign: 'center', color: '#A0AEC0', fontWeight: 'bold' }}>— OR —</div>
      
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          value={joinInput} onChange={(e) => setJoinInput(e.target.value)}
          placeholder="Code" maxLength={4} style={{ flex: 1, textTransform: 'uppercase', textAlign: 'center' }}
        />
        <button className="btn-success" onClick={() => joinRoom(joinInput)} disabled={joinInput.length === 0 || !playerName.trim()}>
          JOIN
        </button>
      </div>
    </div>
  );

  const renderInRoom = () => (
    <div className="panel" style={{ textAlign: 'center' }}>
      <h2 style={{ letterSpacing: '2px', color: '#00A6ED' }}>Room: {roomCode}</h2>
      
      <h3>Players ({players.length}/6):</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
        {players.map((p) => (
          <li key={p.id} style={{ margin: '0.5rem 0' }}>
            {p.name} {p.id === socket.id && '(You)'} {p.isAdmin && '👑'}
          </li>
        ))}
      </ul>
      
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isAmAdmin ? (
          <button className="btn-success" onClick={startGame} disabled={players.length < 2}>
            {players.length >= 2 ? 'Start Game!' : 'Waiting for others...'}
          </button>
        ) : (
          <div style={{ padding: '1rem', background: '#EDF2F7', borderRadius: '8px', color: '#718096', fontWeight: 'bold' }}>
            Waiting for host to start...
          </div>
        )}
        <button className="btn-outline" onClick={leaveRoom}>Leave Room</button>
      </div>
    </div>
  );

  const renderGame = () => {
    if (!gameState) return null;

    const { phase, currentQuestion, answers, sequence, askerIndex, score, scoringResults } = gameState;
    const asker = players[askerIndex];
    const hasAnswered = socket.id ? answers[socket.id] !== undefined : false;
    const haveIPlacedMyTile = sequence.some(p => p.id === socket.id);
    const allTilesPlaced = sequence.length === players.length;

    return (
      <div className="panel">
        
        <div style={{ textAlign: 'center' }}>
          <div className="question-text">{currentQuestion}</div>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="announcer">
              🗣️ {asker?.id === socket.id ? "YOU get" : `${asker?.name} gets`} to ask a question!
            </span>
          </div>
        </div>

        {/* SCORE BANNER */}
        {phase === 'REVEALING' && score !== undefined && (
          <div className="team-score">
            <h2>Team Score: {score} / {players.length}</h2>
            <p>{score === players.length ? 'Flawless Victory! 🎉' : 'Better luck next time!'}</p>
          </div>
        )}

        {/* PHASE 1: ANSWERING */}
        {phase === 'ANSWERING' && (
          <div style={{ textAlign: 'center', padding: '1.5rem', background: '#F7FAFC', borderRadius: '12px' }}>
            {hasAnswered ? (
              <h3 style={{ color: 'var(--success)' }}>Locked in! Waiting for others...</h3>
            ) : (
              <div>
                <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Secretly lock in your number:</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  <input 
                    type="number" value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)} 
                    placeholder="0-100" style={{ width: '100px', textAlign: 'center' }}
                  />
                  <button className="btn-primary" onClick={submitAnswer} disabled={!myAnswer}>
                    Lock In
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2 & 3: PLACING AND REVEALING */}
        {(phase === 'PLACING' || phase === 'REVEALING') && (
          <div>
            
            {phase === 'PLACING' && !haveIPlacedMyTile && (
              <div className="unplaced-tile-container">
                <div 
                  className="unplaced-tile"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', socket.id || '')}
                >
                  {me?.name}'s Tile (Drag Me!)
                </div>
              </div>
            )}

            {/* THE TABLE */}
            <div className="table-area">
              <div className="table-label">Highest Numbers (Top)</div>

              {phase === 'PLACING' && (
                <div className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 0)} />
              )}

              {sequence.map((player, index) => {
                const result = phase === 'REVEALING' && scoringResults ? scoringResults[player.id] : null;
                const isFailed = result === 'failed';
                
                // Get a consistent color based on their original index in the players array
                const colorIndex = players.findIndex(p => p.id === player.id) % tileColors.length;
                const tileColor = tileColors[colorIndex];

                return (
                  <React.Fragment key={player.id}>
                    <div 
                      className={`tile ${phase === 'PLACING' ? 'draggable' : ''} ${isFailed ? 'tile-failed' : ''}`}
                      draggable={phase === 'PLACING'}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', player.id)}
                      style={{ background: isFailed ? '' : tileColor }}
                    >
                      {player.name} {isFailed && '❌'} {result === 'success' && '✅'}
                      
                      {phase === 'REVEALING' && (
                        <span className="tile-number">{answers[player.id]}</span>
                      )}
                    </div>

                    {phase === 'PLACING' && (
                      <div className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, index + 1)} />
                    )}
                  </React.Fragment>
                );
              })}

              {sequence.length === 0 && (
                <div style={{ textAlign: 'center', color: '#A0AEC0', padding: '2rem 0', fontWeight: 'bold' }}>
                  The table is empty. Drag a tile here!
                </div>
              )}

              <div className="table-label">Lowest Numbers (Bottom)</div>
            </div>

            {/* Admin Controls */}
            {phase === 'PLACING' && isAmAdmin && (
              <button 
                className="btn-reveal" 
                onClick={triggerReveal} disabled={!allTilesPlaced}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                {allTilesPlaced ? 'Reveal Cards!' : 'Waiting for everyone to place...'}
              </button>
            )}

            {phase === 'REVEALING' && isAmAdmin && (
              <button className="btn-next" onClick={nextRound} style={{ width: '100%', marginTop: '1rem' }}>
                Start Next Round
              </button>
            )}
            
            {phase === 'REVEALING' && !isAmAdmin && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#A0AEC0', fontWeight: 'bold' }}>
                Waiting for host to start the next round...
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <h1 className="logo">Fun Facts ✨</h1>
      
      {appState === 'LOBBY' && renderLobby()}
      {(appState === 'CREATING' || appState === 'JOINING') && <h2 style={{ textAlign: 'center', color: 'white' }}>Loading...</h2>}
      {appState === 'IN_ROOM' && renderInRoom()}
      {appState === 'IN_GAME' && renderGame()}
    </div>
  );
}