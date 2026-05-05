import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Set up Socket.io and allow our Vite frontend to connect. Updated CORS to allow anyone for this innocent party game
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Pragmatic fix: allows any frontend to connect
    methods: ["GET", "POST"]
  }
});

// The expanded bank of questions for the game
const questions = [
  // The Original 20
  "How much do you enjoy reading while on the toilet? (0-100)",
  "In a restaurant, what is the maximum amount of time you will wait for a table? (Minutes)",
  "How much do you enjoy celebrating your birthday? (0-100)",
  "How scared are you of heights? (0-100)",
  "How much do you enjoy fixing things yourself? (0-100)",
  "How many unread emails are currently in your personal inbox?",
  "How many alarms do you set to wake up in the morning?",
  "What is the longest road trip you've ever taken? (Hours)",
  "How confident are you that you could survive a zombie apocalypse? (0-100)",
  "How spicy do you like your food? (0-100)",
  "How many cups of coffee/tea do you need to function optimally?",
  "What percentage of your phone battery gives you anxiety? (0-100)",
  "How much do you care about astrology/zodiac signs? (0-100)",
  "How likely are you to sing loudly in the car when alone? (0-100)",
  "How many houseplants have you accidentally killed?",
  "At what age do you think someone officially becomes 'old'?",
  "How much do you enjoy small talk with strangers? (0-100)",
  "How many consecutive hours could you play video games without a break?",
  "How many times a week do you eat takeout/delivery?",
  "How much do you trust your own sense of direction without GPS? (0-100)",

  // New Vibe Checks (0-100)
  "How competitive do you get when playing casual board games? (0-100)",
  "How much do you believe in ghosts or the paranormal? (0-100)",
  "How likely are you to cancel plans at the last minute just to stay home? (0-100)",
  "How much does bad grammar in a text message bother you? (0-100)",
  "How confident are you that you could land a commercial airplane in an emergency? (0-100)",
  "How likely are you to strike up a conversation with an Uber/Lyft driver? (0-100)",
  "How much do you enjoy going to weddings? (0-100)",
  "How likely are you to actually read the 'Terms and Conditions'? (0-100)",
  "How much do you care about keeping your living space perfectly clean? (0-100)",
  "How much do you love the smell of gasoline? (0-100)",
  "How much do you enjoy true crime podcasts or documentaries? (0-100)",
  "How likely are you to hold a grudge after an apology? (0-100)",
  "How much do you enjoy riding extreme rollercoasters? (0-100)",
  "How likely are you to hit 'snooze' instead of getting up immediately? (0-100)",
  "How much do you care about having the latest technology or gadgets? (0-100)",

  // New Quantities & Counts
  "How many tabs are currently open on your phone's internet browser?",
  "How many unread text messages are currently on your phone?",
  "How many subscriptions (Netflix, gym, etc.) do you pay for but rarely use?",
  "How many times per year do you actually go to a movie theater?",
  "How many different cities or towns have you lived in?",
  "How many physical books did you actually finish reading last year?",
  "How many times a day do you look at yourself in a mirror or reflective surface?",
  "How many hours of sleep a night do you *actually* get on an average weekday?",
  "How many times have you been pulled over by the police?",
  "What is the maximum number of days you would wear the same pair of jeans without washing them?",
  "How many different passwords do you regularly rotate between?",
  "How many selfies do you have to take before you find one you actually like?",
  "How many times have you cried while watching a movie or TV show?",
  "How many completely useless facts do you have memorized? (Estimate)",
  "At what age did you find out the truth about Santa Claus/Tooth Fairy?",

  // New Time limits & Durations
  "What is the maximum number of minutes you will wait for a friend who is running late before getting annoyed?",
  "What is the maximum number of seconds the '5-second rule' applies to for a dropped piece of food?",
  "How many minutes does it typically take you to get ready in the morning?",
  "How many days do you think you could survive in the wilderness completely alone?",
  "How many years do you think it will be until humans walk on Mars?",
  "How many hours could you spend wandering around IKEA or Target without going crazy?",
  "What is the longest you've ever gone without taking a shower? (Days)",
  "How many minutes past the start time is it acceptable to show up to a casual party?",
  "How many months could you last without looking at any social media?",
  "How many hours of a bad movie will you watch before finally giving up and turning it off?"
];

// This object stores all active rooms and their game states in the server's memory
const rooms = {};

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // 1. Handle CREATE ROOM
  socket.on('create_room', (playerName, callback) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    socket.join(roomCode);
    
    // Initialize the room with the creator as the Admin
    rooms[roomCode] = {
      players: [{ id: socket.id, name: playerName, isAdmin: true }],
      gameState: null 
    };
    
    console.log(`🏠 ${playerName} created room: ${roomCode}`);
    callback({ success: true, roomCode, players: rooms[roomCode].players });
  });

  // 2. Handle JOIN ROOM
  socket.on('join_room', ({ roomCode, playerName }, callback) => {
    const room = rooms[roomCode];
    if (room) {
      if (room.players.length >= 6) {
        return callback({ success: false, error: "Room is full (Max 6 players)" });
      }
      if (room.gameState !== null) {
        return callback({ success: false, error: "Game already in progress" });
      }

      socket.join(roomCode);
      room.players.push({ id: socket.id, name: playerName, isAdmin: false });
      
      console.log(`👋 ${playerName} joined ${roomCode}`);
      socket.to(roomCode).emit('room_updated', room.players);
      callback({ success: true, players: room.players });
    } else {
      callback({ success: false, error: "Room not found" });
    }
  });

  // 3. Handle START GAME
  socket.on('start_game', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players.find(p => p.id === socket.id)?.isAdmin) {
      room.gameState = {
        phase: 'ANSWERING',
        currentQuestion: questions[Math.floor(Math.random() * questions.length)],
        answers: {}, 
        sequence: [], 
        askerIndex: Math.floor(Math.random() * room.players.length),
      };
      io.to(roomCode).emit('game_started', room.gameState);
    }
  });

  // 4. Handle SUBMITTING AN ANSWER
  socket.on('submit_answer', ({ roomCode, answer }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameState) return;

    room.gameState.answers[socket.id] = answer;
    
    // If everyone has locked in their answer, move to PLACING phase
    if (Object.keys(room.gameState.answers).length === room.players.length) {
      room.gameState.phase = 'PLACING';
    }
    io.to(roomCode).emit('game_state_updated', room.gameState);
  });

  // 5. Handle DRAG & DROP TILE PLACEMENT
  socket.on('place_tile', ({ roomCode, draggedPlayerId, targetIndex }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameState || room.gameState.phase !== 'PLACING') return;

    let seq = room.gameState.sequence;
    
    // Check if this player's tile is ALREADY on the board
    const existingIndex = seq.findIndex(p => p.id === draggedPlayerId);
    let playerObj;

    if (existingIndex !== -1) {
      // They are moving an existing tile! Remove it from its current spot.
      playerObj = seq.splice(existingIndex, 1)[0];
      // Adjust the target index if we removed the tile from ABOVE the target
      if (existingIndex < targetIndex) targetIndex -= 1;
    } else {
      // It's their first time placing it. Find them in the room roster.
      playerObj = room.players.find(p => p.id === draggedPlayerId);
    }

    // Insert the tile at the new target index
    if (playerObj) {
      seq.splice(targetIndex, 0, playerObj);
    }

    io.to(roomCode).emit('game_state_updated', room.gameState);
  });

  // 6. Handle REVEALING CARDS (Admin only)
  socket.on('reveal_cards', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players.find(p => p.id === socket.id)?.isAdmin) {
      room.gameState.phase = 'REVEALING';

      // --- NEW: COOPERATIVE SCORING MATH ---
      const seq = room.gameState.sequence;
      const answers = room.gameState.answers;
      
      let score = 0;
      let validMax = -Infinity;
      let scoringResults = {}; // Will track 'success' or 'failed' for each player's ID

      // Loop from the BOTTOM (Lowest index N-1) to the TOP (Highest index 0)
      for (let i = seq.length - 1; i >= 0; i--) {
        const playerId = seq[i].id;
        const val = answers[playerId];

        // If the number is greater than or equal to the previous valid card, it survives!
        if (val >= validMax) {
          score++;
          validMax = val;
          scoringResults[playerId] = 'success';
        } else {
          // It broke the chain, mark it as failed
          scoringResults[playerId] = 'failed';
        }
      }

      // Save the results into the game state so the frontend can display them
      room.gameState.score = score;
      room.gameState.scoringResults = scoringResults;

      io.to(roomCode).emit('game_state_updated', room.gameState);
    }
  });

  // 7. Handle STARTING NEXT ROUND
  socket.on('next_round', (roomCode) => {
    const room = rooms[roomCode];
    if (!room || !room.gameState) return;

    // Shift the designated asker to the next person in the circle
    let nextAsker = room.gameState.askerIndex + 1;
    if (nextAsker >= room.players.length) nextAsker = 0;

    room.gameState = {
      phase: 'ANSWERING',
      currentQuestion: questions[Math.floor(Math.random() * questions.length)],
      answers: {},
      sequence: [],
      askerIndex: nextAsker,
    };
    io.to(roomCode).emit('game_state_updated', room.gameState);
  });

  // 8. Helper function to handle a player leaving or disconnecting
  const handlePlayerLeave = (socketId) => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIndex = room.players.findIndex(p => p.id === socketId);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // If the room is empty, delete it from memory
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          // If the admin left, promote the next person in line to Admin
          if (!room.players.some(p => p.isAdmin)) {
            room.players[0].isAdmin = true; 
          }
          
          // If a game is active, we also need to remove them from the sequence/answers
          if (room.gameState) {
            room.gameState.sequence = room.gameState.sequence.filter(p => p.id !== socketId);
            delete room.gameState.answers[socketId];
            
            // Adjust asker index if necessary
            if (room.gameState.askerIndex >= room.players.length) {
              room.gameState.askerIndex = 0;
            }
            
            io.to(roomCode).emit('game_state_updated', room.gameState);
          }
          
          io.to(roomCode).emit('room_updated', room.players);
        }
        break; // A user is only ever in one room
      }
    }
  };

  socket.on('leave_room', (roomCode) => {
    socket.leave(roomCode);
    handlePlayerLeave(socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    handlePlayerLeave(socket.id);
  });
});

// Updated to look for Render's env variables
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});