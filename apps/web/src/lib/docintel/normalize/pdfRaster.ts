/**
 * docintel/normalize/pdfRaster — rasterize a PDF into one PNG Buffer per page.
 *
 * pdf-lib (already a dep) does NOT rasterize, so we use pdfjs-dist's legacy Node
 * build with a @napi-rs/canvas-backed CanvasFactory. Both are dynamic-imported so
 * they NEVER load unless a real PDF arrives (keeps the default image path cheap).
 *
 * NEVER throws: on any failure returns { pages: [], error: '<reason>' }. Empty
 * pages is a HARD FAILURE the caller must treat as such — never a silent success.
 */

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]) // "%PDF"

/** Magic-byte PDF detection (%PDF at offset 0). */
export function isPdf(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).equals(PDF_MAGIC)
}

interface CanvasLike {
  width: number
  height: number
  getContext(kind: '2d'): unknown
  toBuffer(mime: 'image/png'): Buffer
}

/**
 * CanvasFactory pdfjs expects: create/reset/destroy. Backed by @napi-rs/canvas
 * (prebuilt native, Vercel-friendly — no node-canvas system libs).
 */
function makeCanvasFactory(createCanvas: (w: number, h: number) => CanvasLike) {
  return class NodeCanvasFactory {
    create(width: number, height: number) {
      const canvas = createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)))
      return { canvas, context: canvas.getContext('2d') }
    }
    reset(
      ctx: { canvas: CanvasLike; context: unknown },
      width: number,
      height: number,
    ) {
      ctx.canvas.width = Math.max(1, Math.ceil(width))
      ctx.canvas.height = Math.max(1, Math.ceil(height))
    }
    destroy(ctx: { canvas: CanvasLike | null; context: unknown }) {
      if (ctx.canvas) {
        ctx.canvas.width = 0
        ctx.canvas.height = 0
      }
      ctx.canvas = null
      ctx.context = null
    }
  }
}

export async function rasterizePdf(
  buf: Buffer,
  opts?: { scale?: number; maxPages?: number },
): Promise<{ pages: Buffer[]; error?: string }> {
  const scale = opts?.scale ?? 2.0
  const maxPages = opts?.maxPages ?? 6

  if (!isPdf(buf)) {
    return { pages: [], error: 'not_a_pdf' }
  }

  try {
    // Dynamic imports: native/heavy deps only load when a PDF actually arrives.
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const canvasMod: any = await import('@napi-rs/canvas')
    const createCanvas = canvasMod.createCanvas as (w: number, h: number) => CanvasLike
    const CanvasFactory = makeCanvasFactory(createCanvas)

    const loadingTask = pdfjs.getDocument({
      // pdfjs wants a Uint8Array it can own; copy to avoid detaching the caller's buffer.
      data: new Uint8Array(buf),
      canvasFactory: new CanvasFactory(),
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
    })
    const pdf = await loadingTask.promise

    const pageCount = Math.min(pdf.numPages, maxPages)
    const pages: Buffer[] = []
    const canvasFactory = new CanvasFactory()

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const { canvas, context } = canvasFactory.create(viewport.width, viewport.height)
      await page.render({
        canvasContext: context,
        viewport,
        canvasFactory,
      }).promise
      pages.push(canvas.toBuffer('image/png'))
      // Free page resources before the next iteration.
      page.cleanup()
    }

    await pdf.cleanup().catch(() => {})
    await loadingTask.destroy?.().catch(() => {})

    if (pages.length === 0) {
      return { pages: [], error: 'pdf_had_no_renderable_pages' }
    }
    return { pages }
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 120) : 'pdf_raster_failed'
    return { pages: [], error: `pdf_raster_failed:${reason}` }
  }
}
