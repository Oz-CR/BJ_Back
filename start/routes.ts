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

router.group(() => {
  router.post('/register', [AuthController, 'register'])
  router.post('/login', [AuthController, 'login'])
  router.post('/validate-token', [AuthController, 'validateToken'])
}).prefix('/api/auth')

router.post('/api/auth/logout', [AuthController, 'logout']).use([middleware.auth()])

router.group(() => {
  router.post('/create-game', [GamesController, 'createGame'])
  router.get('/pack/:id', [GamesController, 'viewPack'])
  router.post('/join/:id', [GamesController, 'joinGame'])
  router.post('/start/:id', [GamesController, 'startGame'])
  router.post('/restart/:id', [GamesController, 'restartGame'])
  router.get('/get/:id', [GamesController, 'getGame'])
}).prefix('/api/games').use([middleware.auth()])

router.group(() => {
  router.post('/hit/:id', [PlayerPacksController, 'hitMe'])
  router.post('/ready/:id', [PlayerPacksController, 'readySelf'])
  router.post('/finish/:id', [PlayerPacksController, 'endTurn'])
  router.post('/blackjack/:id', [PlayerPacksController, 'blackJack'])
  router.get('/my-pack', [PlayerPacksController, 'myCardsPack'])
}).prefix('/api/packs').use([middleware.auth()])