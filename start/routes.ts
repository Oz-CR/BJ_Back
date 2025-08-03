/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import GamesController from '#controllers/games_controller'
import AuthController from '#controllers/auth_controller'
import PlayerPacksController from '#controllers/player_packs_controller'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router
  .group(() => {
    router.post('/register', '#controllers/auth_controller.register')
    router.post('/login', '#controllers/auth_controller.login')
    router.post('/validate-token', '#controllers/auth_controller.validateToken')
  })
  .prefix('/api/auth')

router.get('/api/auth/me', '#controllers/auth_controller.me').use([middleware.auth()])
router.post('/api/auth/logout', '#controllers/auth_controller.logout').use([middleware.auth()])
router.post('/create-game', '#controllers/games_controller.createGame').use([middleware.auth()])
router.get('/games/:id', '#controllers/games_controller.getGame').use([middleware.auth()])
router.post('/games/:id/join', '#controllers/games_controller.joinGame').use([middleware.auth()])
router.post('/games/:id/start', '#controllers/games_controller.startGame').use([middleware.auth()])
router.post('/games/:id/leave', '#controllers/games_controller.leaveGame').use([middleware.auth()])
