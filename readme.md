# Prisma + PostgreSQL (Init)

### 1. Lancer la base de données (Docker)

```bash
docker compose up -d
docker compose ps   # vérifier que "emoji_chat" est healthy
```

### 2. Installer Prisma

```bash
npm install -D prisma
npm install @prisma/client
npx prisma init --datasource-provider postgresql
```

### 3. Appliquer le schéma à la base

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. (Optionnel) Ouvrir Prisma Studio

```bash
npx prisma studio
```