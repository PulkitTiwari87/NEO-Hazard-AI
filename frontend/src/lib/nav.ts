export interface NavItem {
  to: string
  label: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Research Overview' },
      { to: '/dashboard', label: 'Project Dashboard' },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/dataset', label: 'Dataset' },
      { to: '/data-quality', label: 'Data Quality' },
      { to: '/exploratory', label: 'Exploratory Analysis' },
      { to: '/explorer', label: 'NEO Explorer' },
    ],
  },
  {
    label: 'Research',
    items: [
      { to: '/feature-audit', label: 'Feature Audit' },
      { to: '/experiment-design', label: 'Experiment Design' },
      { to: '/experiments', label: 'Experiments' },
      { to: '/model-comparison', label: 'Model Comparison' },
      { to: '/cross-validation', label: 'Cross Validation' },
      { to: '/original-experiment', label: 'Legacy Baseline' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { to: '/analysis/confusion', label: 'Confusion Matrices' },
      { to: '/analysis/roc', label: 'ROC Analysis' },
      { to: '/analysis/precision-recall', label: 'Precision-Recall' },
      { to: '/analysis/threshold', label: 'Threshold Analysis' },
      { to: '/analysis/calibration', label: 'Calibration' },
      { to: '/analysis/importance', label: 'Feature Importance' },
      { to: '/analysis/shap', label: 'SHAP Analysis' },
      { to: '/analysis/errors', label: 'Error Analysis' },
      { to: '/analysis/anomaly', label: 'Anomaly Detection' },
    ],
  },
  {
    label: 'Reproducibility',
    items: [
      { to: '/run-info', label: 'Run Information' },
      { to: '/provenance', label: 'Data Provenance' },
      { to: '/methodology', label: 'Methodology' },
      { to: '/limitations', label: 'Limitations' },
    ],
  },
]
