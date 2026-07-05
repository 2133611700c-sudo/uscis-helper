/**
 * documentPostureEnvelope — the MANDATORY pre-reader posture/capture contract
 * (owner patch 2026-07-05, realistic scope: assemble EXISTING signals, not a new product).
 *
 * WHY: orientation/quality/fit are critical preprocessing factors for OCR, and today their
 * signals are scattered (EXIF normalize in image-preprocess, content-orient in the reader,
 * quality in documentImageQuality, forensics fields). This envelope is ONE typed structure
 * built BEFORE any reader scoring, with HONEST `not_measured` for everything we do not
 * actually measure yet. It is a SIGNAL/evidence layer — it never blocks reading in this
 * patch and never boosts reader confidence.
 *
 * Laws:
 *  - never claim a field measured when it is not (`not_measured` is a first-class value);
 *  - never rotate silently: rotation facts arrive here FROM recorded sources only;
 *  - posture_gate != 'pass' can only ADD review signals (monotonic-up), never lift them.
 */

export interface DocumentPostureEnvelope {
  input_format: 'full_page_image' | 'pdf_page' | 'manual_crop' | 'screenshot' | 'unknown'
  exif_orientation: 'present' | 'missing' | 'stripped' | 'applied' | 'unknown'
  preprocess_rotation_applied: boolean
  content_rotation_applied_cw: 0 | 90 | 180 | 270 | null
  orientation_status: 'upright' | 'rotated_90' | 'rotated_180' | 'rotated_270' | 'uncertain' | 'not_measured'
  orientation_source: 'exif' | 'content_orient' | 'manual_owner' | 'test_harness' | 'not_measured'
  orientation_confidence: 'high' | 'medium' | 'low' | 'unknown'
  quality_status: 'ok' | 'blurred' | 'too_dark' | 'too_bright' | 'low_resolution' | 'not_measured'
  document_fit: 'full_page_visible' | 'cropped_or_partial' | 'manual_crop' | 'unknown' | 'not_measured'
  crop_source: 'full_page' | 'manual_crop' | 'frozen_box' | 'detected_box' | 'template_box' | 'unknown'
  posture_gate: 'pass' | 'review_orientation_uncertain' | 'review_quality_low' | 'review_document_partial' | 'not_measured'
}

export interface PostureInputs {
  /** EXIF orientation tag as seen at intake (forensic), if captured */
  exifOrientation?: number | null
  /** sharp .rotate() applied an EXIF-based rotation in preprocess */
  preprocessRotationApplied?: boolean | null
  /** content-orient applied this CW rotation (0 = ran, no rotation needed) */
  contentRotationCw?: number | null
  /** content-orient ran but could not decide */
  orientationUncertain?: boolean
  /** whether the content-orient stage ran at all */
  contentOrientRan?: boolean
  /** documentImageQuality verdict when the quality gate ran ('ok'|'blurred'|...) */
  qualityStatus?: DocumentPostureEnvelope['quality_status'] | null
  /** how the bytes reached the reader */
  cropSource?: DocumentPostureEnvelope['crop_source']
  inputFormat?: DocumentPostureEnvelope['input_format']
}

/** Assemble the envelope from RECORDED signals only. Missing signal ⇒ honest not_measured. */
export function buildPostureEnvelope(i: PostureInputs): DocumentPostureEnvelope {
  const exif: DocumentPostureEnvelope['exif_orientation'] =
    i.exifOrientation === undefined ? 'unknown'
      : i.exifOrientation === null ? 'missing'
      : i.preprocessRotationApplied ? 'applied'
      : 'present'

  let orientation_status: DocumentPostureEnvelope['orientation_status'] = 'not_measured'
  let orientation_source: DocumentPostureEnvelope['orientation_source'] = 'not_measured'
  let orientation_confidence: DocumentPostureEnvelope['orientation_confidence'] = 'unknown'
  if (i.contentOrientRan) {
    orientation_source = 'content_orient'
    if (i.orientationUncertain) {
      orientation_status = 'uncertain'
      orientation_confidence = 'low'
    } else {
      const cw = (i.contentRotationCw ?? 0) as 0 | 90 | 180 | 270
      // After an APPLIED content rotation the page is upright by the detector's verdict;
      // the applied angle is preserved separately. Detector instability on some docs is a
      // MEASURED fact — confidence stays 'medium', never 'high', until the Phase C matrix.
      orientation_status = 'upright'
      orientation_confidence = cw === 0 ? 'medium' : 'medium'
    }
  } else if (i.preprocessRotationApplied) {
    orientation_status = 'upright'
    orientation_source = 'exif'
    orientation_confidence = 'medium' // EXIF is metadata — can lie/be stripped; never 'high'
  }

  const quality_status = i.qualityStatus ?? 'not_measured'
  const document_fit: DocumentPostureEnvelope['document_fit'] = 'not_measured' // no fit detector exists yet — honest
  const crop_source = i.cropSource ?? 'unknown'

  let posture_gate: DocumentPostureEnvelope['posture_gate']
  if (orientation_status === 'uncertain') posture_gate = 'review_orientation_uncertain'
  else if (quality_status !== 'ok' && quality_status !== 'not_measured') posture_gate = 'review_quality_low'
  else if (orientation_status === 'not_measured' && quality_status === 'not_measured') posture_gate = 'not_measured'
  else posture_gate = 'pass'

  return {
    input_format: i.inputFormat ?? 'unknown',
    exif_orientation: exif,
    preprocess_rotation_applied: i.preprocessRotationApplied === true,
    content_rotation_applied_cw: i.contentOrientRan ? (((i.contentRotationCw ?? 0) as 0 | 90 | 180 | 270)) : null,
    orientation_status,
    orientation_source,
    orientation_confidence,
    quality_status,
    document_fit,
    crop_source,
    posture_gate,
  }
}
