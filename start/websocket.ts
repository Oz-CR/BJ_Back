import { createServer } from "node:http"
import { Server as WebSocketServer } from "socket.io"

const port = process.env.WEB_SOCKET_PORT
const wsServer = createServer()

export const io = new WebSocketServer(wsServer, {
    cors: {
        origin: "*"
    }
})

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`)

    socket.on("join", (game_id: string) => {
        socket.join(game_id)
        console.log(`Client ${socket.id} joined game ${game_id}`)
    })

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`)
    })
})

wsServer.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`)
})