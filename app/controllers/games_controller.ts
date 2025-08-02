import type { HttpContext } from '@adonisjs/core/http'
import { Games } from '#models/game'
import User from '#models/user'
import { Cards } from '#models/card'
import { PlayerPacks } from '#models/player_pack'
import mongoose from 'mongoose'
import { io } from '#start/websocket'

interface CardsP {
    _id: mongoose.Types.ObjectId
    suit: string
    rank: string
}

interface GamesP {
    _id: mongoose.Types.ObjectId
    owner_id: number
    pack: mongoose.Types.ObjectId[]
    is_active: boolean
    is_ended: boolean
    player_ids: number[]
    turn: number
    winner_id: number | null
}

const reshufflePack = async(): Promise<CardsP[]> => {
    const cards = await Cards.find({})
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]]
    } 
    return cards as CardsP[]
}

const startGame = async(gameId: string): Promise<GamesP> => {
    const game = await Games.findById(gameId)
    if(!game) {
        throw new Error('Game not found')
    }

    const shuffled_pack = await reshufflePack()
    if (shuffled_pack.length < 52) {
        throw new Error('Dech must have 52 cards')
    }

    game.pack = shuffled_pack.map(card => card._id)

    const player_packs = await PlayerPacks.find({game_id: game._id})
    for (const player_pack of player_packs) {
        player_pack.pack = []
        player_pack.count = 0
        player_pack.total_value = 0
        await player_pack.save()
    }

    game.is_active = true
    game.turn = 0
    game.winner_id = null

    for (const player_pack of player_packs) {
        const cardsToGive = []

        for (let i = 0; i < 2; i++) {
            const card = game.pack.pop()
            if (card) {
                cardsToGive.push(card)
            }
        }

        if (cardsToGive.length === 0) {
            throw new Error('Not enough cards to start')
        }

        const cards = await Cards.find({ _id: { $in: cardsToGive } })

        player_pack.pack = cardsToGive
        player_pack.count = cardsToGive.length
        player_pack.total_value = cards.reduce((sum, card) => sum + (card.value ?? 0), 0)

        await player_pack.save()
    }

    await game.save()
    return {
        _id: game._id,
        owner_id: game.owner_id,
        pack: game.pack,
        is_active: game.is_active,
        is_ended: game.is_ended,
        player_ids: game.player_ids,
        turn: game.turn,
        winner_id: game.winner_id ?? null
    } as GamesP
}

export default class GamesController {
    async viewPack({params, response}: HttpContext) {
        const game_id = params.id;
        const game = await Games.findById(game_id).populate('pack');

        if (!game) {
          return response.notFound({
            message: 'Game not found'
          });
        }

        return response.ok({
          message: 'Pack retrieved successfully',
          data: {
            deck: game.pack,
            count: game.pack.length
          }
        });
    }

    async getGame({params, auth, response}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game_id = params.id;

        const game = await Games.findById(game_id).populate('pack');

        if (!game) {
          return response.notFound({
            message: 'Game not found'
          });
        }

        const playersPacks = await PlayerPacks.find({ game_id: game._id }).populate('pack');
        if (!playersPacks) {
          return response.notFound({
            message: 'No player decks found for this game'
          });
        }

        if (!game.player_ids.includes(user.id)) {
          return response.forbidden({
            message: 'You are not part of this game'
          });
        }

        const playersData = await User.query().whereIn('id', game.player_ids)
        const playersPacksWithData = [];

        for (const playerPack of playersPacks) {
          const user = await User.findBy('id', playerPack.player_id);
          const playerPackData = {
            ...playerPack.toObject(),
            player: user
          }
          playersPacksWithData.push(playerPackData);
        }

        const isPlayerTurn = game.turn === game.player_ids.indexOf(user.id);

        const winnerData = game.winner_id ? await User.findBy('id', game.winner_id) : null;

        if (game.owner_id === user.id) {
          const gameObject = game.toObject();
          const gameWithData = {
            ...gameObject,
            players: playersData,
            winner: winnerData
          };

          return response.ok({
            message: 'Game retrieved successfully',
            data: {
              isOwner: game.owner_id === user.id,
              game: gameWithData,
              playersPacks: playersPacksWithData,
              isYourTurn: isPlayerTurn
            }
          });
        } else {
          const playerPack = playersPacks.find(pack => pack.player_id === user.id);
          if (!playerPack) {
            return response.notFound({
              message: 'Player pack not found for this user'
            });
          }

          const gameObject = game.toObject();
          const gameWithoutDeck = {
            ...gameObject,
            deck: undefined,
            players: playersData,
            winner: winnerData
          }
          return response.ok({
            message: 'Game retrieved successfully',
            data: {
              isOwner: game.owner_id === user.id,
              game: gameWithoutDeck,
              playersPacks: playersPacksWithData.filter(deck => deck.player_id === user.id),
              isYourTurn: isPlayerTurn,
            }
          });
        }
    }

    async createGame({auth, response, request}: HttpContext) {
        const user = await auth.use('api').authenticate()
        const { name } = request.only(['name'])
        
        if (!name || !name.trim()) {
          return response.badRequest({
            message: 'Game name is required'
          });
        }
        
        const cards = await reshufflePack();

        const testCards = await Cards.find({})
        console.log('Cartas obtenidas: ', cards.length, testCards.length)

        if (cards.length !== 52) {
          return response.badRequest({
            message: 'Deck must contain exactly 52 cards'
          });
        }

        const game = new Games({
          name: name.trim(),
          owner_id: user.id,
          pack: cards.map(card => card._id),
          player_ids: [user.id],
          is_active: false,
          is_ended: false,
          turn: 0,
          winner_id: null,
        })
        await game.save();


        const playerPack = new PlayerPacks({
          player_id: user.id,
          game_id: game._id,
          pack: [],
          count: 0,
          total_value: 0,
          is_ready: false
        })

        await playerPack.save();

        const gameCreated = await Games.findById(game._id).populate('pack');

        if (!gameCreated) {
          return response.internalServerError({
            message: 'Error creating game'
          });
        }

        const playersData = await User.query().whereIn('id', gameCreated.player_ids);
        const gameWithData = {
          ...gameCreated.toObject(),
          players: playersData
        }
        
        // Notificar a todos los clientes conectados que hay un nuevo juego
        io.emit('game_list_updated');

        return response.created({
          message: 'Game created successfully',
          data: {
            game: gameWithData
          }
        })
    }

    async joinGame({params, auth, response}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game_id = params.id

        const game = await Games.findById(game_id);
        if (!game) {
            return response.notFound({
                message: 'Game not found'
            });
        }

        if (game.player_ids.includes(user.id)) {
            return response.badRequest({
                message: 'You are already in this game'
            });
        }

        if (game.player_ids.length >= 7) {
            return response.badRequest({
                message: 'Game is full'
            });
        }

        if (game.is_active) {
            return response.badRequest({
                message: 'Game is already active'
            });
        }

        if (game.is_ended) {
            return response.badRequest({
                message: 'Game has already finished'
            });
        }

        game.player_ids.push(user.id);
        const playerPack = new PlayerPacks({
        player_id: user.id,
        game_id: game._id,
        pack: [],
        count: 0
        });

        await playerPack.save();

        await game.save();

        const gameUpdated = await Games.findById(game._id);
        if (!gameUpdated) {
            return response.internalServerError({
                message: 'Error updating game'
            });
        }

        const playersData = await User.query().whereIn('id', gameUpdated.player_ids);

        const gameWithoutDeck = {
            ...gameUpdated.toObject(),
            deck: undefined,
            players: playersData
        }

        io.to(`game:${game._id}`).emit('gameNotify', { game: game._id });

        return response.ok({
            message: 'Joined game successfully',
            data: {
                game: gameWithoutDeck
            }
        });
    }

    async startGame({params, response, auth}: HttpContext) {
        const game_id = params.id;
        const game = await Games.findById(game_id);
        const user = await auth.use('api').authenticate();

        if (!game) {
            return response.notFound({
                message: 'Game not found'
            });
        }

        if (game.is_active) {
            return response.badRequest({
                message: 'Game is already active'
            });
        }

        if (game.player_ids.length < 2) {
            return response.badRequest({
                message: 'Not enough players to start the game'
            });
        }

        if (game.owner_id !== user.id) {
            return response.forbidden({
                message: 'Only the game owner can start the game'
            });
        }

        const playerPacks = await PlayerPacks.find({ game_id: game._id }).populate('pack');
        for (const playerPack of playerPacks) {
            if (!playerPack.is_ready) {
                return response.badRequest({
                message: 'All players must be ready to start the game'
                });
            }
        }
        game.is_active = true;
        game.turn = 0;

        for (const playerPack of playerPacks) {
            const cardsToGive = [];
            for (let i = 0; i < 2; i++) {
                const card = game.pack.pop();
                if (card) {
                cardsToGive.push(card);
                }
            }
            if (cardsToGive.length === 0) {
                return response.badRequest({
                message: 'Not enough cards in the deck to start the game'
                });
            }
            const cards = await Cards.find({ _id: { $in: cardsToGive } });
            playerPack.pack = cardsToGive;
            playerPack.count = cardsToGive.length;
            playerPack.total_value = cards.reduce((sum, card) => sum + (card.value ?? 0), 0);

            await playerPack.save();
        }

        await game.save();

        const gameStarted = await Games.findById(game._id).populate('pack');
        if (!gameStarted) {
        return response.internalServerError({
            message: 'Error starting game'
        });
        }

        const playersData = await User.query().whereIn('id', gameStarted.player_ids);
        const gameWithData = {
        ...gameStarted.toObject(),
        players: playersData
        }
        io.to(`game:${game._id}`).emit('gameNotify', { game: game._id });


        return response.ok({
        message: 'Game started successfully',
        data: {
            game: gameWithData,
        }
        });
    }

    async leaveGame({params, auth, response}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game_id = params.id;

        const game = await Games.findById(game_id);
        if (!game) {
            return response.notFound({
                message: 'Game not found'
            });
        }

        if (!game.is_active) {
            return response.badRequest({
                message: 'Game is not active'
            });
        }

        if (!game.player_ids.includes(user.id)) {
            return response.badRequest({
                message: 'You are not in this game'
            });
        }

        const playerIsOwner = game.owner_id === user.id;
        if (playerIsOwner) {
            game.set({ is_ended: true });
            await game.save();
        }


        game.player_ids = game.player_ids.filter(player_id => player_id !== user.id);
        game.is_active = false;
        await game.save();

        io.to(`game:${game._id}`).emit('gameNotify', { game: game._id });

        await PlayerPacks.deleteMany({ player_id: user.id, game_id: game._id });
            return response.ok({
            message: 'Left game successfully',
            data: game
        });

    }

    async restartGame({params, auth, response}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game_id = params.id;

        const game = await Games.findById(game_id);
        if (!game) {
            return response.notFound({
                message: 'Game not found'
            });
        }

        if (game.winner_id === null) {
            return response.badRequest({
                message: 'Game is not finished yet'
            });
        }

        if (game.owner_id !== user.id) {
            return response.forbidden({
                message: 'Only the game owner can restart the game'
            });
        }

        if (game.player_ids.length < 2) {
            return response.badRequest({
                message: 'Not enough players to restart the game'
            });
        }

        const playerPacks = await PlayerPacks.find({ game_id: game._id }).populate('pack');
        for (const playerPack of playerPacks) {
        if (!playerPack.is_ready) {
            return response.badRequest({
            message: 'All players must be ready to start the game'
            });
        }
        }

        try {
            const gameRestarted = await startGame(game_id);
            if (!gameRestarted) {
                return response.internalServerError({
                    message: 'Error restarting game'
                });
            }
            io.to(`game:${game._id}`).emit('gameNotify', { game: game._id });

            return response.ok({
                message: 'Game restarted successfully',
                data: gameRestarted
            });
        } catch (error) {
            return response.internalServerError({
                message: 'Error restarting game',
                error: error.message
            });
        }
    }
}