#!/bin/bash
# Script para crear estructura base del monorepo Aether

echo "🚀 Creando estructura de proyecto Aether..."

mkdir -p aether/{frontend/src/{assets,components,core,modules/{auth,dashboard,tasks,organization,ai},routes,hooks,types},backend/{prisma,migrations,src/{common,config,modules/{auth,users,tasks,commits,organization,ai-reports}}},ai/app/{routers,services,models,utils},database,docs/{diagrams}}
cd aether

# Archivos base
touch README.md .gitignore .env package.json
touch backend/prisma/schema.prisma backend/src/app.module.ts backend/src/main.ts backend/src/prisma.service.ts
touch ai/app/main.py ai/requirements.txt ai/.env
touch database/seed.sql
touch frontend/src/App.tsx frontend/src/main.tsx frontend/tailwind.config.js frontend/tsconfig.json

echo "✅ Estructura de carpetas creada con éxito"
