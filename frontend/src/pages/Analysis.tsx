import { AnalysisFrame, CalibrationPanel, ConfusionPanel, PrPanel, RocPanel, ThresholdPanel } from '../components/panels'

export function ConfusionPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · Confusion matrices"
      title="Confusion matrices"
      description="Counts of correct and incorrect predictions on the held-out test set. Switch experiment and model to compare error patterns."
    >
      {(detail) => <ConfusionPanel detail={detail} />}
    </AnalysisFrame>
  )
}

export function RocPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · ROC"
      title="ROC analysis"
      description="Receiver operating characteristic on the held-out test set: true-positive rate against false-positive rate across every threshold."
      explainer={
        <p>
          ROC-AUC summarizes ranking performance across classification thresholds. It ignores class prevalence, so with a
          rare positive class it can look flattering — read it together with the precision–recall view.
        </p>
      }
    >
      {(detail) => <RocPanel detail={detail} />}
    </AnalysisFrame>
  )
}

export function PrecisionRecallPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · Precision–recall"
      title="Precision–recall"
      description="Precision against recall on the held-out test set. Because hazardous objects are the minority class, this is the more demanding view."
      explainer={
        <p>
          A classifier with no skill has precision equal to the positive-class prevalence at every recall level (the dashed
          line). PR-AUC is average precision: the area under the curve, weighting each threshold by its recall gain.
        </p>
      }
    >
      {(detail) => <PrPanel detail={detail} />}
    </AnalysisFrame>
  )
}

export function ThresholdPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · Threshold"
      title="Threshold analysis"
      description="How precision, recall and F1 trade off as the decision threshold moves, from the backend's out-of-fold sweep."
      explainer={
        <p>
          Raising the threshold makes the model more conservative: precision tends to rise and recall to fall. Nothing is
          recomputed in your browser — the slider only moves between the sweep's stored grid points.
        </p>
      }
    >
      {(detail) => <ThresholdPanel detail={detail} />}
    </AnalysisFrame>
  )
}

export function CalibrationPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · Calibration"
      title="Calibration"
      description="Whether predicted probabilities match observed frequencies on the held-out test set."
      explainer={
        <p>
          Calibration matters when a probability is read as a probability. The Brier score is the mean squared error of the
          predicted probability; lower is better. A model can rank well (high ROC-AUC) and still be poorly calibrated.
        </p>
      }
    >
      {(detail) => <CalibrationPanel detail={detail} />}
    </AnalysisFrame>
  )
}
