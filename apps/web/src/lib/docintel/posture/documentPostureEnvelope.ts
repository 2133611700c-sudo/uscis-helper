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
  exif_orientation: 'present' | 'missing' | 'stripped' | 'applied' | 'suspicious' | 'unknown'
  preprocess_rotation_applied: boolean
  content_rotation_applied_cw: 0 | 90 | 180 | 270 | null
  orientation_status: 'upright' | 'rotated_90' | 'rotated_180' | 'rotated_270' | 'uncertain' | 'not_measured'
  orientation_source: 'exif' | 'content_orient' | 'handwritten_layout_backstop' | 'sparse_layout_backstop' | 'visual_oracle' | 'manual_owner' | 'test_harness' | 'not_measured'
  orientation_confidence: 'high' | 'medium' | 'low' | 'unknown'
  quality_status: 'ok' | 'blurred' | 'too_dark' | 'too_bright' | 'low_resolution' | 'degraded_other' | 'not_measured'
  document_fit: 'full_page_visible' | 'cropped_or_partial' | 'manual_crop' | 'unknown' | 'not_measured'
  crop_source: 'full_page' | 'manual_crop' | 'frozen_box' | 'detected_box' | 'template_box' | 'unknown'
  posture_gate: 'pass' | 'review_orientation_uncertain' | 'review_quality_low' | 'review_document_partial' | 'not_measured'
  /** Which layout backstop, if any, settled the orientation decision. */
  orientation_backstop_used: 'none' | 'handwritten_layout' | 'sparse_layout'
  /** true when the ORIENT_180_CHECK binary confirm ran and resolved the pose (either "candidate
   *  confirmed" or "flipped"); absent when the check did not run (flag OFF, or 4-cell vote itself
   *  failed before reaching it). Evidence only — does NOT raise orientation_confidence above medium. */
  orientation_180_disambiguated?: boolean
  /** true when the sparse-form 90° adjunct confirm ran and resolved the pose. */
  orientation_90_disambiguated?: boolean
}

export interface PostureInputs {
  /** EXIF orientation tag as seen at intake (forensic), if captured */
  exifOrientation?: number | null
  /** sharp .rotate() applied an EXIF-based rotation in preprocess */
  preprocessRotationApplied?: boolean | null
  /** content-orient applied this CW rotation (0 = ran, no rotation needed) */
  contentRotationCw?: number | null
  /** content-orient ran AND applied a non-zero correction on top of an EXIF-rotated buffer —
   *  deterministic proof the EXIF tag was wrong (measured twice: birth_cert tag 6, military_p2 tag 3). */
  contentOrientCorrectedExif?: boolean
  /** content-orient ran but could not decide */
  orientationUncertain?: boolean
  /** ORIENT_180_CHECK confirmed/flipped the candidate — extra evidence the pose is disambiguated
   *  from its 180° twin (still capped at 'medium' until the full fixture matrix hits 0 false-pass). */
  disambiguated180?: boolean
  /** Sparse-form 90° adjunct confirm resolved the pose against the 90° neighbor. */
  disambiguated90?: boolean
  /** Which backstop, if any, was used by the orientation detector before the envelope was built. */
  layoutBackstopUsed?: 'handwritten_layout' | 'sparse_layout' | null
  /** document_fit verdict when a fit heuristic ran; absent → honest not_measured. */
  documentFit?: DocumentPostureEnvelope['document_fit'] | null
  /** whether the content-orient stage ran at all */
  contentOrientRan?: boolean
  /** documentImageQuality verdict when the quality gate ran ('ok'|'blurred'|...) */
  qualityStatus?: DocumentPostureEnvelope['quality_status'] | null
  /** how the bytes reached the reader */
  cropSource?: DocumentPostureEnvelope['crop_source']
  inputFormat?: DocumentPostureEnvelope['input_format']
}

/**
 * Map the D0 intake quality verdict (documentImageQuality) to the envelope's quality_status.
 * ACCEPT ⇒ 'ok'; otherwise the dominant failing/warning signal names the reason; a degradation
 * we cannot attribute stays honest 'degraded_other' (never silently 'ok').
 */
export function qualityStatusFromQualityResult(q: {
  decision: 'ACCEPT' | 'DEGRADED_REVIEW' | 'RESHOOT_REQUIRED'
  signals: Array<{ name: string; status: 'ok' | 'warning' | 'fail'; reason?: string }>
}): DocumentPostureEnvelope['quality_status'] {
  if (q.decision === 'ACCEPT') return 'ok'
  const bad = [...q.signals.filter((s) => s.status === 'fail'), ...q.signals.filter((s) => s.status === 'warning')]
  for (const s of bad) {
    if (s.name === 'blur') return 'blurred'
    if (s.name === 'resolution') return 'low_resolution'
    if (s.name === 'brightness') return /bright|overexpos/i.test(s.reason ?? '') ? 'too_bright' : 'too_dark'
  }
  return 'degraded_other'
}

/** Assemble the envelope from RECORDED signals only. Missing signal ⇒ honest not_measured. */
export function buildPostureEnvelope(i: PostureInputs): DocumentPostureEnvelope {
  // suspicious: EXIF WAS applied in preprocess, but content-orient still had to correct the
  // buffer further -> the EXIF tag was wrong (deterministic fact, not a guess). Measured twice:
  // birth_cert_handwritten_01 (tag 6) and military_id_p2_01 (tag 3) both lied this way.
  const exif: DocumentPostureEnvelope['exif_orientation'] =
    i.exifOrientation === undefined ? 'unknown'
      : i.exifOrientation === null ? 'missing'
      : i.preprocessRotationApplied && i.contentOrientCorrectedExif ? 'suspicious'
      : i.preprocessRotationApplied ? 'applied'
      : 'present'

  let orientation_status: DocumentPostureEnvelope['orientation_status'] = 'not_measured'
  let orientation_source: DocumentPostureEnvelope['orientation_source'] = 'not_measured'
  let orientation_confidence: DocumentPostureEnvelope['orientation_confidence'] = 'unknown'
  if (i.contentOrientRan) {
    orientation_source = i.layoutBackstopUsed === 'handwritten_layout'
      ? 'handwritten_layout_backstop'
      : i.layoutBackstopUsed === 'sparse_layout'
        ? 'sparse_layout_backstop'
        : 'content_orient'
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
  const document_fit = i.documentFit ?? 'not_measured'
  const crop_source = i.cropSource ?? 'unknown'
  const orientation_backstop_used = i.layoutBackstopUsed ?? 'none'

  let posture_gate: DocumentPostureEnvelope['posture_gate']
  if (orientation_status === 'uncertain') posture_gate = 'review_orientation_uncertain'
  else if (quality_status !== 'ok' && quality_status !== 'not_measured') posture_gate = 'review_quality_low'
  else if (document_fit === 'cropped_or_partial' || document_fit === 'manual_crop') posture_gate = 'review_document_partial'
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
    orientation_backstop_used,
    ...(i.disambiguated180 !== undefined ? { orientation_180_disambiguated: i.disambiguated180 } : {}),
    ...(i.disambiguated90 !== undefined ? { orientation_90_disambiguated: i.disambiguated90 } : {}),
  }
}
