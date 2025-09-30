import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async () => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: {
        name: 'asc'
      }
    })
    
    return {
      success: true,
      rooms: rooms
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des rooms:', error)
    return {
      success: false,
      error: 'Erreur lors de la récupération des rooms'
    }
  }
})
