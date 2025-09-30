import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultRooms = [
  {
    name: 'Général',
    emoji: '💬'
  },
  {
    name: 'Technologie',
    emoji: '💻'
  },
  {
    name: 'Gaming',
    emoji: '🎮'
  },
  {
    name: 'Musique',
    emoji: '🎵'
  },
  {
    name: 'Sports',
    emoji: '🏆'
  },
  {
    name: 'Actualités',
    emoji: '📰'
  },
  {
    name: 'Random',
    emoji: '🎲'
  },
  {
    name: 'Aide',
    emoji: '🆘'
  }
]

async function main() {
  console.log('🌱 Début du seeding des rooms par défaut...')

  for (const roomData of defaultRooms) {
    // Vérifier si la room existe déjà
    const existingRoom = await prisma.room.findUnique({
      where: { name: roomData.name }
    })
    
    if (!existingRoom) {
      await prisma.room.create({
        data: {
          name: roomData.name,
          emoji: roomData.emoji
        }
      })
      console.log(`✅ Room "${roomData.name}, ${roomData.emoji}" créée`)
    } else {
      console.log(`⚠️  Room "${roomData.name}, ${roomData.emoji}" existe déjà`)
    }
  }
  
  console.log('🎉 Seeding terminé!')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
