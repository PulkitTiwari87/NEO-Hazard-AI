// Shared chart theme constants — see the dataviz skill. Validated against
// this app's dark surface (#05070d). Import MODEL_COLOR/MODEL_LABEL from
// ../../api/client so model color assignment is defined in exactly one place.
export const MUTED = '#898781'
export const GRID = '#2c2c2a'
export const SECONDARY_INK = '#c3c2b7'
export const TOOLTIP_STYLE = { background: '#0d0d0d', border: '1px solid #2c2c2a', fontSize: 12 }

export const EXPERIMENT_COLOR: Record<string, string> = {
  experiment_a_original: '#3987e5',
  experiment_b_leakage_aware: '#c9539a',
}

// Target-class colors for EDA/target-analysis charts (distinct from model
// colors used on Model Performance pages).
export const TARGET_COLOR = { hazardous: '#d95926', not_hazardous: '#3987e5' }

export function tickStyle() {
  return { fill: MUTED, fontSize: 11 }
}
