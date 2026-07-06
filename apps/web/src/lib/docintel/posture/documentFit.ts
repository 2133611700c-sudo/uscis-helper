/**
 * documentFit — conservative page-fit evidence for the pre-reader posture envelope.
 *
 * Goal: distinguish obviously cropped/partial inputs from intact full-page captures using only
 * the same image bytes that would later enter the reader. This is intentionally conservative:
 * it only claims `cropped_or_partial` when the image is very likely cut off, otherwise it falls
 * back to full_page_visible / unknown instead of guessing.
 */
import sharp from 'sharp'
import type { DocumentPostureEnvelope } from './documentPostureEnvelope'

export interface DocumentFitObservation {
  document_fit: DocumentPostureEnvelope['document_fit']
  edge_contact_count: number
  ink_ratio: number
}

const INK_LEVEL = 96
// Only classify as partial when ink is extremely close to all four sides.
// This is deliberately stricter than the first probe because normal full-page
// photos can also have dense margins or borders near the frame.
const EDGE_CONTACT_RATIO = 0.85
const PARTIAL_EDGE_COUNT = 4
const MIN_INK_RATIO = 0.01

async function edgeInkRatio(data: Buffer, width: number, height: number, side: 'top' | 'bottom' | 'left' | 'right'): Promise<number> {
  const band = Math.max(1, Math.floor(Math.min(width, height) * 0.03))
  let ink = 0
  let total = 0
  if (side === 'top' || side === 'bottom') {
    const yStart = side === 'top' ? 0 : height - band
    const yEnd = side === 'top' ? band : height
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < width; x++) {
        total++
        if (data[y * width + x] <= INK_LEVEL) ink++
      }
    }
  } else {
    const xStart = side === 'left' ? 0 : width - band
    const xEnd = side === 'left' ? band : width
    for (let y = 0; y < height; y++) {
      for (let x = xStart; x < xEnd; x++) {
        total++
        if (data[y * width + x] <= INK_LEVEL) ink++
      }
    }
  }
  return total > 0 ? ink / total : 0
}

export async function assessDocumentFit(
  buffer: Buffer,
  inputFormat: DocumentPostureEnvelope['input_format'] = 'unknown',
): Promise<DocumentFitObservation> {
  if (inputFormat === 'manual_crop') {
    const { data, info } = await sharp(buffer).grayscale().normalise().raw().toBuffer({ resolveWithObject: true })
    let ink = 0
    for (let i = 0; i < data.length; i++) if (data[i] <= INK_LEVEL) ink++
    return {
      document_fit: 'manual_crop',
      edge_contact_count: 4,
      ink_ratio: ink / Math.max(1, info.width * info.height),
    }
  }

  try {
    const { data, info } = await sharp(buffer)
      .grayscale()
      .normalise()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const width = info.width
    const height = info.height
    if (!width || !height) {
      return { document_fit: 'unknown', edge_contact_count: 0, ink_ratio: 0 }
    }

    let ink = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] > INK_LEVEL) continue
        ink++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    const inkRatio = ink / Math.max(1, width * height)
    if (ink === 0) return { document_fit: 'unknown', edge_contact_count: 0, ink_ratio: 0 }

    const edgeRatios = {
      top: await edgeInkRatio(data, width, height, 'top'),
      bottom: await edgeInkRatio(data, width, height, 'bottom'),
      left: await edgeInkRatio(data, width, height, 'left'),
      right: await edgeInkRatio(data, width, height, 'right'),
    }

    const touches = [
      minX <= 1 || edgeRatios.left >= EDGE_CONTACT_RATIO,
      minY <= 1 || edgeRatios.top >= EDGE_CONTACT_RATIO,
      maxX >= width - 2 || edgeRatios.right >= EDGE_CONTACT_RATIO,
      maxY >= height - 2 || edgeRatios.bottom >= EDGE_CONTACT_RATIO,
    ].filter(Boolean).length

    if (touches >= PARTIAL_EDGE_COUNT && inkRatio >= MIN_INK_RATIO) {
      return { document_fit: 'cropped_or_partial', edge_contact_count: touches, ink_ratio: inkRatio }
    }

    return { document_fit: 'full_page_visible', edge_contact_count: touches, ink_ratio: inkRatio }
  } catch {
    return { document_fit: 'unknown', edge_contact_count: 0, ink_ratio: -1 }
  }
}
