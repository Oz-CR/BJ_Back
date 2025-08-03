import { Games } from '#models/game'
import { createServer } from 'node:http'
import { Server as WebSocketServer } from 'socket.io'

const port = process.env.WEB_SOCKET_PORT ?? '3001'
const wsServer = createServer()

export const io = new WebSocketServer(wsServer, {
  cors: {
    origin: '*',
  },
})

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('join', (game_id: string) => {
    socket.join(game_id)
    console.log(`Client ${socket.id} joined game ${game_id}`)
  })

  // Nuevo manejo específico para salas de juego
  socket.on('join_game_room', ({ gameId }) => {
    socket.join(`game:${gameId}`)
    console.log(`Client ${socket.id} joined game room ${gameId}`)
  })

  socket.on('leave_game_room', ({ gameId }) => {
    socket.leave(`game:${gameId}`)
    console.log(`Client ${socket.id} left game room ${gameId}`)
  })

  socket.on('find_available_games', async () => {
    try {
      // Primero buscar todos los juegos para debug
      const allGames = await Games.find({})
      console.log(`Total games in DB: ${allGames.length}`)
      
      // Buscar juegos que no hayan terminado
      const availableGames = await Games.find({ 
        is_ended: { $ne: true }
      })
      console.log(`Found ${availableGames.length} available games`)
      console.log('Available games:', availableGames.map(g => ({ 
        _id: g._id,
        name: g.name || 'Sin nombre', 
        owner_id: g.owner_id, 
        is_active: g.is_active, 
        is_ended: g.is_ended,
        player_count: g.player_ids?.length || 0
      })))
      
      socket.emit('available_games', availableGames)
    } catch (error) {
      console.error('Error fetching games:', error)
      socket.emit('available_games', [])
    }
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

wsServer.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`)
})
