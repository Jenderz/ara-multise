# Script de Inicialización de Git para Ara E-commerce
# Ejecutar después de instalar Git

Write-Host "🚀 Inicializando repositorio Git..." -ForegroundColor Cyan

# 1. Configurar Git (cambiar con tus datos)
Write-Host "`n📝 Configurando Git..." -ForegroundColor Yellow
git config --global user.name "Jender"
git config --global user.email "jenderzavala@gmail.com"
git config --global init.defaultBranch main

# 2. Inicializar repositorio
Write-Host "`n📦 Inicializando repositorio..." -ForegroundColor Yellow
git init

# 3. Agregar todos los archivos
Write-Host "`n➕ Agregando archivos..." -ForegroundColor Yellow
git add .

# 4. Primer commit
Write-Host "`n💾 Creando primer commit..." -ForegroundColor Yellow
git commit -m "feat: initial commit - Ara E-commerce Multisede v1.0"

Write-Host "`n✅ ¡Repositorio Git inicializado correctamente!" -ForegroundColor Green
Write-Host "`nPróximos pasos:" -ForegroundColor Cyan
Write-Host "1. Crear repositorio en GitHub/GitLab" -ForegroundColor White
Write-Host "2. Ejecutar: git remote add origin https://github.com/Jenderz/ara-multise.git" -ForegroundColor White
Write-Host "3. Ejecutar: git push -u origin main" -ForegroundColor White
