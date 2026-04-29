2# 📚 Guía Completa: Configurar Git y Subir a GitHub

## ✅ Paso 1: Verificar Instalación de Git

**Cierra y vuelve a abrir tu terminal**, luego ejecuta:

```bash
git --version
```

Deberías ver algo como: `git version 2.52.0.windows.1`

---

## 🔧 Paso 2: Configurar Git (Primera vez)

Configura tu nombre y email (aparecerán en los commits):

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
git config --global init.defaultBranch main
```

Verificar configuración:
```bash
git config --list
```

---

## 📦 Paso 3: Inicializar Repositorio Local

### Opción A: Usar el script automático (Recomendado)

```powershell
# En PowerShell
.\init-git.ps1
```

### Opción B: Manual

```bash
# 1. Inicializar Git
git init

# 2. Agregar todos los archivos
git add .

# 3. Crear primer commit
git commit -m "feat: initial commit - Ara E-commerce Multisede v1.0"
```

---

## 🌐 Paso 4: Crear Repositorio en GitHub

1. Ve a [GitHub](https://github.com) e inicia sesión
2. Click en el botón **"+"** → **"New repository"**
3. Configura:
   - **Repository name**: `ara-multisede` (o el nombre que prefieras)
   - **Description**: "Plataforma de E-commerce profesional con gestión multisede"
   - **Visibility**: 
     - ✅ **Private** (recomendado para proyectos comerciales)
     - ⚠️ **Public** (solo si quieres código abierto)
   - ❌ **NO** marcar "Initialize with README" (ya lo tienes)
4. Click en **"Create repository"**

---

## 🔗 Paso 5: Conectar Repositorio Local con GitHub

GitHub te mostrará comandos. Usa estos:

```bash
# Agregar repositorio remoto
git remote add origin https://github.com/Jenderz/ara-multise.git

# Subir código
git push -u origin main
```

**Nota**: Reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub.

---

## 🔐 Paso 6: Autenticación

### Opción A: Personal Access Token (Recomendado)

1. Ve a GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Configura:
   - **Note**: "Ara E-commerce"
   - **Expiration**: 90 días (o lo que prefieras)
   - **Scopes**: Marca ✅ **repo** (todos los permisos de repositorio)
4. Click **"Generate token"**
5. **⚠️ COPIA EL TOKEN** (solo se muestra una vez)
6. Cuando Git pida contraseña, usa el token en lugar de tu contraseña

### Opción B: SSH (Avanzado)

```bash
# Generar clave SSH
ssh-keygen -t ed25519 -C "tu@email.com"

# Copiar clave pública
cat ~/.ssh/id_ed25519.pub

# Agregar en GitHub → Settings → SSH Keys
```

Luego usa URL SSH:
```bash
git remote set-url origin git@github.com:TU-USUARIO/ara-multisede.git
```

---

## 📝 Paso 7: Workflow Diario

### Hacer cambios y subirlos

```bash
# 1. Ver archivos modificados
git status

# 2. Agregar archivos específicos
git add archivo1.tsx archivo2.tsx

# O agregar todos los cambios
git add .

# 3. Crear commit con mensaje descriptivo
git commit -m "feat: agregar filtro de búsqueda en catálogo"

# 4. Subir a GitHub
git push
```

### Tipos de commits (Conventional Commits)

```bash
git commit -m "feat: nueva funcionalidad"      # Nueva característica
git commit -m "fix: corregir bug en carrito"   # Corrección
git commit -m "docs: actualizar README"        # Documentación
git commit -m "style: formatear código"        # Estilo
git commit -m "refactor: optimizar componente" # Refactorización
git commit -m "chore: actualizar dependencias" # Mantenimiento
```

### Ver historial

```bash
git log --oneline --graph --all
```

### Crear rama para nueva funcionalidad

```bash
# Crear y cambiar a nueva rama
git checkout -b feature/nueva-funcionalidad

# Hacer cambios y commits
git add .
git commit -m "feat: implementar nueva funcionalidad"

# Subir rama a GitHub
git push -u origin feature/nueva-funcionalidad
```

---

## 🚨 Comandos Útiles

### Deshacer cambios

```bash
# Descartar cambios en archivo (antes de commit)
git checkout -- archivo.tsx

# Deshacer último commit (mantener cambios)
git reset --soft HEAD~1

# Deshacer último commit (eliminar cambios)
git reset --hard HEAD~1
```

### Actualizar desde GitHub

```bash
# Traer cambios
git pull
```

### Ver diferencias

```bash
# Ver cambios no commiteados
git diff

# Ver cambios en archivo específico
git diff archivo.tsx
```

### Ignorar archivos

Los archivos en `.gitignore` no se suben. Ya está configurado para:
- ✅ `node_modules/`
- ✅ `.env.local`
- ✅ `public/lib/config.php`
- ✅ Archivos de build

---

## 🔒 Seguridad: Archivos que NUNCA debes subir

⚠️ **CRÍTICO**: Estos archivos están en `.gitignore` y NO deben subirse:

- ❌ `public/lib/config.php` (credenciales de base de datos)
- ❌ `.env.local` (API keys)
- ❌ `node_modules/` (dependencias)
- ❌ Archivos con contraseñas

### Verificar antes de push

```bash
# Ver qué archivos se subirán
git status

# Si ves archivos sensibles, agrégalos a .gitignore
echo "archivo-sensible.php" >> .gitignore
git add .gitignore
git commit -m "chore: actualizar gitignore"
```

---

## 🎯 Checklist Final

Antes de tu primer push:

- [ ] Git está instalado (`git --version`)
- [ ] Configuraste nombre y email
- [ ] Revisaste `.gitignore`
- [ ] NO hay archivos sensibles en staging
- [ ] Creaste repositorio en GitHub
- [ ] Conectaste remote origin
- [ ] Hiciste primer commit
- [ ] Subiste código (`git push`)

---

## 🆘 Problemas Comunes

### "git: command not found"
**Solución**: Cierra y vuelve a abrir la terminal después de instalar Git.

### "Permission denied"
**Solución**: Usa Personal Access Token en lugar de contraseña.

### "Failed to push"
**Solución**: 
```bash
git pull --rebase
git push
```

### "Archivo grande no se sube"
**Solución**: Agrégalo a `.gitignore` si no es necesario.

---

## 📚 Recursos Adicionales

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)

---

## 🎉 ¡Listo!

Tu proyecto ahora está versionado con Git y sincronizado con GitHub. 

**Próximos pasos**:
1. Invitar colaboradores (si aplica)
2. Configurar GitHub Actions para CI/CD
3. Crear ramas para desarrollo
4. Hacer commits frecuentes

¡Feliz coding! 🚀
