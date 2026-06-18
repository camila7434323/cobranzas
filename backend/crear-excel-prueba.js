const XLSX = require('xlsx')
const path = require('path')

const datos = [
  { 'Fecha': '2025-01-15', 'Comprobante': 'FC 001-0000001', 'Cliente': 'CLIENTE A', 'Condición de Venta': '30', 'Vencimiento': '2025-02-14', 'Importe': 15000, 'Mora': 0 },
  { 'Fecha': '2025-01-15', 'Comprobante': 'FC 001-0000002', 'Cliente': 'CLIENTE A', 'Condición de Venta': '30', 'Vencimiento': '2025-02-14', 'Importe': 8500, 'Mora': 0 },
  { 'Fecha': '2025-01-20', 'Comprobante': 'FCM 001-0000001', 'Cliente': 'CLIENTE B', 'Condición de Venta': '60', 'Vencimiento': '2025-03-21', 'Importe': 22500, 'Mora': 0 },
  { 'Fecha': '2025-01-20', 'Comprobante': 'FCM 001-0000002', 'Cliente': 'CLIENTE B', 'Condición de Venta': '60', 'Vencimiento': '2025-03-21', 'Importe': 12000, 'Mora': 0 },
  { 'Fecha': '2025-01-10', 'Comprobante': 'NC 001-0000001', 'Cliente': 'CLIENTE C', 'Condición de Venta': '30', 'Vencimiento': '2025-02-09', 'Importe': 5000, 'Mora': 39 },
  { 'Fecha': '2025-01-25', 'Comprobante': 'FC 001-0000003', 'Cliente': 'CLIENTE D', 'Condición de Venta': '15', 'Vencimiento': '2025-02-09', 'Importe': 18750, 'Mora': 9 },
  { 'Fecha': '2025-01-12', 'Comprobante': 'FCM 001-0000003', 'Cliente': 'CLIENTE E', 'Condición de Venta': '45', 'Vencimiento': '2025-02-26', 'Importe': 9250, 'Mora': 23 },
  { 'Fecha': '2025-01-18', 'Comprobante': 'ND 001-0000001', 'Cliente': 'CLIENTE F', 'Condición de Venta': '30', 'Vencimiento': '2025-02-17', 'Importe': 3500, 'Mora': 1 },
  { 'Fecha': '2025-01-22', 'Comprobante': 'FC 001-0000004', 'Cliente': 'CLIENTE A', 'Condición de Venta': '30', 'Vencimiento': '2025-02-21', 'Importe': 11000, 'Mora': 0 },
  { 'Fecha': '2025-01-28', 'Comprobante': 'FCM 001-0000004', 'Cliente': 'CLIENTE G', 'Condición de Venta': '60', 'Vencimiento': '2025-03-29', 'Importe': 27500, 'Mora': 0 },
  { 'Fecha': '2025-01-08', 'Comprobante': 'NCM 001-0000001', 'Cliente': 'CLIENTE H', 'Condición de Venta': '30', 'Vencimiento': '2025-02-07', 'Importe': 6750, 'Mora': 41 },
  { 'Fecha': '2025-01-16', 'Comprobante': 'FC 001-0000005', 'Cliente': 'CLIENTE I', 'Condición de Venta': '30', 'Vencimiento': '2025-02-15', 'Importe': 13200, 'Mora': 3 },
  { 'Fecha': '2025-01-19', 'Comprobante': 'ND 001-0000002', 'Cliente': 'CLIENTE J', 'Condición de Venta': '45', 'Vencimiento': '2025-03-05', 'Importe': 4800, 'Mora': 14 },
  { 'Fecha': '2025-01-23', 'Comprobante': 'FC 001-0000006', 'Cliente': 'CLIENTE K', 'Condición de Venta': '30', 'Vencimiento': '2025-02-22', 'Importe': 19500, 'Mora': 0 },
  { 'Fecha': '2025-01-26', 'Comprobante': 'FCM 001-0000005', 'Cliente': 'CLIENTE L', 'Condición de Venta': '60', 'Vencimiento': '2025-03-27', 'Importe': 24000, 'Mora': 0 },
]

const ws = XLSX.utils.json_to_sheet(datos)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes')

const outputPath = path.join(__dirname, '..', 'excel-prueba.xlsx')
XLSX.writeFile(wb, outputPath)

console.log('✅ Excel de prueba creado: excel-prueba.xlsx')
console.log(`📊 ${datos.length} comprobantes de ejemplo\n`)
console.log('📋 Primeros 5 comprobantes:\n')
datos.slice(0, 5).forEach((f, i) => {
  console.log(`${i+1}. ${f.Comprobante.padEnd(16)} | ${f.Cliente.padEnd(12)} | $${String(f.Importe).padEnd(8)} | Mora: ${f.Mora}d`)
})
console.log('\n✨ Archivo listo para cargar en la aplicación')
