# 🧪 GUÍA DE PRUEBAS - VERIFICAR SOLUCIÓN

## ✅ PASO 1: RECOMPILAR EL BACKEND

```bash
cd c:\Users\Usuario\Desktop\ASAP\Cobranzas\backend

# Limpiar
npm run build

# O si está en modo desarrollo
npm run dev
```

**Esperado**: Sin errores de compilación

---

## ✅ PASO 2: RECOMPILAR EL FRONTEND

```bash
cd c:\Users\Usuario\Desktop\ASAP\Cobranzas\frontend

# Instalar si es necesario
npm install

# Compilar
npm run dev
```

**Esperado**: Aplicación corre en localhost:5173 sin errores en consola

---

## ✅ PASO 3: PROBAR CON EXCEL VÁLIDO

1. Abre la aplicación en http://localhost:5173
2. Carga un Excel con:
   - Columna "Comprobante" con valores como "FC 001", "FCM 002"
   - Columna "Importe" o similar con números
   - Datos de clientes

**Esperado**: 
- ✅ Se procesa correctamente
- ✅ NO aparece pantalla blanca
- ✅ Datos se sincronizans a la BD
- ✅ En consola ves logs como:
  ```
  📥 Se leyeron 150 filas
  ✅ Fila 5: FC 001 - Cliente XYZ - $1000
  📊 Comprobantes válidos: 120
  ```

---

## ✅ PASO 4: PROBAR CON EXCEL PROBLEMÁTICO

### Caso 1: Filas vacías
1. Crea Excel con filas completamente vacías en el medio
2. Cargalo

**Esperado**:
- ✅ Las filas vacías se ignoran
- ✅ Se procesan solo las filas válidas
- ✅ En logs: `⏭️  Fila 10 vacía, saltando...`

### Caso 2: Montos inválidos
1. Crea Excel con montos como "abc", "$-100", etc.
2. Cargalo

**Esperado**:
- ✅ Las filas con montos inválidos se ignoran o usan 0
- ✅ En logs: `⚠️  Fila 8: Monto inválido (abc)`

### Caso 3: Sin columna Comprobante
1. Crea Excel SIN columna "Comprobante"
2. Intenta cargarlo

**Esperado**:
- ✅ En lugar de pantalla blanca, ves:
  ```
  ⚠️  Error al procesar el archivo
  No se encontró la columna Comprobante en el Excel.
  ```

### Caso 4: Excel completamente vacío
1. Crea Excel sin datos
2. Intenta cargarlo

**Esperado**:
- ✅ Mensaje de error: `El archivo Excel está vacío`

---

## ✅ PASO 5: VERIFICAR ERROR BOUNDARY

1. Abre DevTools (F12)
2. Ve a la pestaña Console
3. Introduce esto en la consola:
   ```javascript
   throw new Error("Test error")
   ```

**Esperado**:
- ✅ En lugar de pantalla blanca, ves una UI roja que dice:
  ```
  ⚠️ Error en la aplicación
  Test error
  ```
- ✅ Botón "Recargar página" funciona

---

## ✅ PASO 6: VERIFICAR LOGS DEL BACKEND

1. En la terminal donde corre `npm run dev` (backend)
2. Carga un Excel
3. Deberías ver algo así:

```
📥 Iniciando procesarExcel...
📥 Se leyeron 150 filas del Excel
✅ Fila 5: FC 001 - ACTIVA BI - $50000
✅ Fila 8: FC 002 - AMX Argentina S.A. - $75000
⏭️  Fila 12 vacía, saltando...
✅ Fila 15: FCM 003 - BOEHRINGER - $100000

📊 RESUMEN:
✅ Comprobantes válidos: 120
⚠️  Errores de validación: 2

🔄 Sincronizando 120 comprobantes...
📊 Nuevos: 100, Reapariciones: 15, Cobradas: 5
✅ Sincronización completada
```

**Beneficio**: Puedes ver exactamente qué se está procesando

---

## ✅ PASO 7: REVISAR VALORES EN BD

1. Conecta a Supabase
2. Ve a tabla `comprobantes`
3. Verifica que:
   - ✅ `nombre_cliente` NO es null
   - ✅ `monto` es número válido (no NaN)
   - ✅ `ejecutivo` tiene valor válido (no "undefined")
   - ✅ `fecha_emision` es null o formato `YYYY-MM-DD`
   - ✅ `fecha_vencimiento` es null o formato `YYYY-MM-DD`

---

## 🔍 CHECKLIST DE VERIFICACIÓN

### Backend
- [ ] Se compiló sin errores
- [ ] Logs detallados aparecen en consola
- [ ] Datos inválidos se rechazan con mensaje claro
- [ ] Las excepciones se capturan correctamente
- [ ] Los valores null/undefined se convierten a defaults

### Frontend
- [ ] ErrorBoundary está importado en main.tsx
- [ ] No aparece pantalla blanca en caso de error
- [ ] Se muestra mensaje de error legible
- [ ] Botón "Recargar página" funciona
- [ ] Datos se sincronizan correctamente

### Excel
- [ ] Excel válidos se procesan sin problemas
- [ ] Excel con filas vacías se maneja correctamente
- [ ] Montos inválidos se ignoran/convierten a 0
- [ ] Fechas inválidas se convierten a null
- [ ] Comprobantes duplicados se detectan

---

## 🚀 SI ALGO AÚN FALLA

### Opción 1: Revisar Logs
1. Abre DevTools (F12)
2. Console: busca mensajes rojos
3. ErrorBoundary debería mostrar el error exacto

### Opción 2: Restaurar Backup
```bash
# Si algo salió mal, restaura el backup
Copy-Item -Path "backend\src\services\procesarExcel.BACKUP.ts" `
          -Destination "backend\src\services\procesarExcel.ts" -Force
```

### Opción 3: Limpiar y Reinstalar
```bash
# Backend
rm -r backend\node_modules
npm install
npm run build

# Frontend
rm -r frontend\node_modules
npm install
npm run dev
```

---

## 📊 MÉTRICAS DE ÉXITO

✅ **Implementación exitosa si:**
1. No hay pantalla blanca al cargar Excel
2. Los errores se muestran con mensaje claro
3. Los logs del backend son informativos
4. Los datos en DB son válidos
5. Filas inválidas se ignoran silenciosamente

---

**¡La aplicación debe ser ahora 100% resistente a Excel problemáticos!** 🎉
