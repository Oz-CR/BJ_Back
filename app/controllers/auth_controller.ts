import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator, loginValidator } from '#validators/auth'

export default class AuthController {
    async register({request, response}: HttpContext) {
        try {
            const data = request.all()
            const payload = await registerValidator.validate(data)

            const existingUser = await User.findBy('email', payload.email)
            if (existingUser) {
                return response.status(409).json({
                    message: 'This email is in use',
                    error: 'USER_EXISTS'
                })
            }

            const user = await User.create({
                fullName: payload.fullName,
                email: payload.email,
                password: payload.password
            })

            const token = await User.accessTokens.create(user, ['*'], {
                expiresIn: '1 day'
            })

            return response.status(201).json({
                message: 'Registered successfully',
                data: {
                    user: user,
                    token: token
                }
            })
        } catch(error) {
            return response.status(500).json({
                message: 'Error during register',
                error: error
            })
        }
    }

    async login({request, response}: HttpContext) {
        try {
            const data = request.all()
            const payload = await loginValidator.validate(data)
            const user = await User.verifyCredentials(payload.email, payload.password)
            const token = await User.accessTokens.create(user, ['*'], {
                expiresIn: '1 day'
            })

            return response.status(200).json({
                message: 'Login successful',
                data: {
                    user: user,
                    token: token.value
                }
            })
        } catch (error) {
            return response.status(500).json({
                message: 'Error during login',
                error: error
            })
        }
    }

    async logout({response, auth}: HttpContext) {
        try {
            const user = await auth.getUserOrFail()
            const token = auth.user?.currentAccessToken

            if (token) {
                await User.accessTokens.delete(user, token.identifier)
            }

            return response.json({
                message: 'Logout successful'
            })
        } catch(error) {
            return response.status(500).json({
                message: 'Could not logout',
                error: error
            })
        }
    }

    async validateToken({response, auth}: HttpContext) {
        try {
            const user = await auth.getUserOrFail()

            return response.status(200).json({
                message: 'Valid token',
                data: {
                    user: user
                }
            })
        } catch (error) {
            return response.status(500).json({
                message: 'Invalid tokeb',
                error: error
            })
        }
    }
}