import { PrismaClient } from '@prisma/client'
import { compare } from 'bcrypt'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    const { username, password } = await readBody(event)

    // Validation basique
    if (!username || !password) {
      return {
        success: false,
        error: 'Username et password requis'
      }
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      return {
        success: false,
        error: 'Username ou mot de passe incorrect'
      }
    }

    // Vérifier le password
    const passwordValid = await compare(password, user.password)

    if (!passwordValid) {
      return {
        success: false,
        error: 'Username ou mot de passe incorrect'
      }
    }

    // Retourner les infos user (sans le password)
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt
      }
    }
  } catch (error) {
    console.error('Erreur lors du login:', error)
    return {
      success: false,
      error: 'Erreur lors de la connexion'
    }
  }
})
