# Guía de Contribución

## 🤝 Cómo Contribuir

¡Gracias por tu interés en contribuir a Ara E-commerce Multisede!

### Proceso de Contribución

1. **Fork el repositorio**
2. **Crea una rama** para tu funcionalidad
   ```bash
   git checkout -b feature/nombre-funcionalidad
   ```
3. **Realiza tus cambios**
4. **Commit con mensajes descriptivos**
   ```bash
   git commit -m "feat: agregar funcionalidad X"
   ```
5. **Push a tu fork**
   ```bash
   git push origin feature/nombre-funcionalidad
   ```
6. **Abre un Pull Request**

### Convenciones de Código

#### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Cambios en documentación
- `style:` Formato, punto y coma faltantes, etc.
- `refactor:` Refactorización de código
- `test:` Agregar tests
- `chore:` Mantenimiento

Ejemplos:
```
feat: agregar filtro por precio en catálogo
fix: corregir cálculo de descuento en carrito
docs: actualizar README con instrucciones de deploy
```

#### TypeScript

- Usar tipos explícitos
- Evitar `any` cuando sea posible
- Documentar funciones complejas

#### React

- Componentes funcionales con hooks
- Props tipadas con TypeScript
- Usar memo para optimización cuando sea necesario

#### CSS/Tailwind

- Usar clases de Tailwind cuando sea posible
- Mantener consistencia con el diseño existente
- Responsive mobile-first

### Testing

Antes de hacer commit:

1. Verificar que el build funciona:
   ```bash
   npm run build
   ```

2. Probar en modo desarrollo:
   ```bash
   npm run dev
   ```

3. Verificar TypeScript:
   ```bash
   npx tsc --noEmit
   ```

### Reportar Bugs

Usa el template de issues e incluye:

- Descripción clara del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si aplica
- Versión del navegador/OS

### Sugerir Funcionalidades

Abre un issue con:

- Descripción de la funcionalidad
- Caso de uso
- Mockups o ejemplos si es posible

## 📋 Checklist antes de PR

- [ ] El código compila sin errores
- [ ] No hay errores de TypeScript
- [ ] El código sigue las convenciones del proyecto
- [ ] Se actualizó la documentación si es necesario
- [ ] Los commits tienen mensajes descriptivos
- [ ] Se probó en diferentes navegadores (si aplica)

## 🙏 Gracias

Tu contribución es valiosa. ¡Gracias por ayudar a mejorar el proyecto!
