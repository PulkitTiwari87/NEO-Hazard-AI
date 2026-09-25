import { AnalysisFrame, FoldPanel } from '../components/panels'

export function CrossValidation() {
  return (
    <AnalysisFrame
      eyebrow="Research · Cross validation"
      title="Cross validation"
      description="Fold-by-fold results on the training split. The spread across folds shows how much each metric depends on which objects landed in which fold."
      explainer={
        <p>
          Stratified k-fold cross-validation preserves the positive-class share in every fold. Hyperparameters are tuned
          within the folds, and the holdout test set is never touched. Unstable folds — a wide bar in the strip below —
          are a sign the metric would not be reliable on new data, especially for a rare positive class.
        </p>
      }
    >
      {(detail) => <FoldPanel detail={detail} />}
    </AnalysisFrame>
  )
}
