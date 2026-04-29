#!/bin/bash
# Script de Inicialización de Git para Ara E-commerce (Linux/Mac)

echo "🚀 Inicializando repositorio Git..."

# 1. Configurar Git (cambiar con tus datos)
echo ""
echo "📝 Configurando Git..."
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
git config --global init.defaultBranch main

# 2. Inicializar repositorio
echo ""
echo "📦 Inicializando repositorio..."
git init

# 3. Agregar todos los archivos
echo ""
echo "➕ Agregando archivos..."
git add .

# 4. Primer commit
echo ""
echo "💾 Creando primer commit..."
git commit -m "feat: initial commit - Ara E-commerce Multisede v1.0"

echo ""
echo "✅ ¡Repositorio Git inicializado correctamente!"
echo ""
echo "Próximos pasos:"
echo "1. Crear repositorio en GitHub/GitLab"
echo "2. Ejecutar: git remote add origin https://github.com/Jenderz/ara-multise.git"
echo "3. Ejecutar: git push -u origin main"
