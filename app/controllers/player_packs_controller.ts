import type { HttpContext } from '@adonisjs/core/http'
import { Games } from '#models/game'
import { PlayerPacks } from '#models/player_pack'
import { Cards } from '#models/card'
import { io } from '#start/websocket'

export default class PlayerPacksController {
    async myCardsPack({auth, params, response}: HttpContext) {
        const user = await auth.use('api').authenticate()
        const playerPack = await PlayerPacks.findOne({player_id: user.id, game_id: params.id}).populate('pack')
        if (!playerPack) {
            return response.notFound({
                message: 'Cards pack not found',
            })
        }

        const playerPackWithData = {
            ...playerPack.toObject(),
            player: user
        }

        return response.ok({
            message: 'Card pack retrieved successfully',
            data: {
                player_pack: playerPackWithData
            }
        })
    }

    async hitMe({auth, params, response}: HttpContext) {
        const user = await auth.use('api').authenticate()
        const game = await Games.findById(params.id)
        if(!game) {
            return response.notFound({
                message: 'Game not found'
            })
        }

        const playerPack = await PlayerPacks.findOne({ player_id: user.id, game_id: game._id })
        if (!playerPack) {
            return response.notFound({
                message: 'Cards pack not found'
            })
        }

        if (!game.is_active) {
            return response.badRequest({
                messages: 'Game not active'
            })
        }

        if (game.winner_id !== null) {
            return response.badRequest({
                message: 'Game already finished'
            })
        }

        const playersInGame = game.player_ids
        if (game.turn !== playersInGame.indexOf(user.id)) {
            return response.badRequest({
                message: 'Wait for your turn'
            })
        }

        const card = game.pack.pop()

        if (!card) {
            return response.badRequest({
                message: 'No more cards in the pack'
            })
        }

        playerPack.pack.push(card)
        playerPack.count += 1
        const cardData = await Cards.findById(card)

        if(!cardData) {
            return response.notFound({
                message: 'Card not found'
            })
        }

        playerPack.total_value += cardData.value ?? 0

        if(playerPack.total_value > 21) {
            playerPack.total_value = -1
            game.turn++

            if (game.turn > playersInGame.length -1) {
                game.turn = 0

                const playersPacks = await PlayerPacks.find({ game_id: game._id })
                const totalValues = playersPacks.map(pack => pack.total_value)
                const maxValue = Math.max(...totalValues)

                game.winner_id = playersPacks.find(pack => pack.total_value === maxValue)?.player_id ?? null

                await playerPack.save()
                await game.save()

                io.to(`Game: ${game._id}`).emit('gameNotification', {game: game._id})

                return response.ok({
                    message: 'Game ended',
                    data: {
                        game: game,
                        playerPack: playerPack
                    }
                })
            }
        }

        await playerPack.save()
        await game.save()

        io.to(`Game: ${game._id}`).emit('gameNotification', {game: game._id})
        
        return response.ok({
            message: 'Successful hit',
            data: {
                card: cardData,
                player_pack: playerPack
            }
        })
    }

    async readySelf({auth, response, params}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game = await Games.findById(params.id);
        if (!game) {
            return response.notFound({
                message: 'Game not found'
            });
        }

        if (game.is_ended) {
            return response.badRequest({
                message: 'Game is already finished'
            });
        }

        const playerDeck = await PlayerPacks.findOne({ player_id: user.id, game_id: game._id });
        if (!playerDeck) {
            return response.notFound({
                message: 'Player deck not found'
            });
        }

        if (playerDeck.is_ready) {
            return response.badRequest({
                message: 'Player is already ready'
            });
        }

        playerDeck.is_ready = true;

        await playerDeck.save();
        io.to(`game:${game._id}`).emit('gameNotification', { game: game._id });
        
        return response.ok({
            message: 'Player is now ready',
            data: {playerDeck: playerDeck}
        });
    }

    async terminarTurno({auth, response, params}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game = await Games.findById(params.id);
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

        const gamePlayers = game.player_ids;
        if (game.turn !== gamePlayers.indexOf(user.id)) {
            return response.badRequest({
                message: 'It is not your turn'
            });
        }
        
        game.turn++;

        if (game.turn > gamePlayers.length - 1) {
            game.turn = 0;
            const playersDecks = await PlayerPacks.find({ game_d: game._id })
            const totalValues = playersDecks.map(deck => deck.total_value)
            const maxValue = Math.max(...totalValues)
            game.winner_id = playersDecks.find(deck => deck.total_value === maxValue)?.player_id ?? null

            await game.save();

            io.to(`Game: ${game._id}`).emit('gameNotification', { game: game._id });

            return response.ok({
                message: 'Game finished',
                data: {
                    game: game,
                    playersDecks: playersDecks.map(deck => ({
                        playerId: deck.player_id,
                        totalValue: deck.total_value
                    }))
                }
            });
        }

        await game.save();

        io.to(`Game: ${game._id}`).emit('gameNotification', { game: game._id });

        return response.ok({
            message: 'Turn ended successfully',
            data: {
                game: game
            }
        });
    }

    async blackJack({auth, response, params}: HttpContext) {
        const user = await auth.use('api').authenticate();
        const game = await Games.findById(params.id);
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

        const playersDecks = await PlayerPacks.find({ game_id: game._id });

        const allHaveTwoCards = playersDecks.every(deck => deck.pack.length === 2);

        console.log('allHaveTwoCards:', allHaveTwoCards);
        console.log('game.turn:', game.turn);

        if (game.turn !== 0 || allHaveTwoCards === false) {
            return response.badRequest({
                message: 'Only can check the blackjack before the game starts'
            })
        }

        const playerDeck = await PlayerPacks.findOne({ player_id: user.id, game_id: game._id });
        if (!playerDeck) {
            return response.notFound({
                message: 'Player deck not found'
            });
        }

        if (playerDeck.total_value === 21) {
            game.winner_id = user.id;
            game.is_ended = true;

            await game.save();

            io.to(`Game: ${game._id}`).emit('gameNotification', { game: game._id });
            
            return response.ok({
                message: 'Blackjack! You win!',
                data: {
                    winner: user.id,
                    game: game
                }
            });
        }

        return response.badRequest({
            message: 'You do not have a blackjack'
        });
    }
}