import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export { parsearFacturaTexto } from './parsearFactura'

export async function extraerTextoPdf(pdfBase64DataUrl: string): Promise<string> {
  const base64 = pdfBase64DataUrl.split(',')[1] || pdfBase64DataUrl
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)

  const doc = await pdfjsLib.getDocument({ data: bytes }).promise
  const lineas: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const contenido = await page.getTextContent()
    let lineaActual = ''
    let yAnterior: number | null = null
    for (const item of contenido.items as { str: string; transform: number[] }[]) {
      const y = item.transform[5]
      if (yAnterior !== null && Math.abs(y - yAnterior) > 2) {
        if (lineaActual.trim()) lineas.push(lineaActual.trim())
        lineaActual = ''
      }
      lineaActual += (lineaActual ? ' ' : '') + item.str
      yAnterior = y
    }
    if (lineaActual.trim()) lineas.push(lineaActual.trim())
  }
  return lineas.join('\n')
}
