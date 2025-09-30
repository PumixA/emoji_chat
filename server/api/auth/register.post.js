import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    const { email, username, password } = await readBody(event)

    // Validation basique
    if (!email || !username || !password) {
      return {
        success: false,
        error: 'Email, username et password requis'
      }
    }

    if (password.length < 6) {
      return {
        success: false,
        error: 'Le mot de passe doit contenir au moins 6 caractères'
      }
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      return {
        success: false,
        error: 'Email ou username déjà utilisé'
      }
    }

    // Hasher le password
    const hashedPassword = await hash(password, 10)

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true
      }
    })

    return {
      success: true,
      user
    }
  } catch (error) {
    console.error('Erreur lors du register:', error)
    return {
      success: false,
      error: 'Erreur lors de la création du compte'
    }
  }
})
