import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/Shell'
import { PageTransition } from './components/PageTransition'
import { EmptyResearchState, LoadingState } from './components/ui'

// Each page is its own chunk: charts and tables only load for the route in view.
function page<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => loader().then((m) => ({ default: m[name] })))
}

const Overview = page(() => import('./pages/Overview'), 'Overview')
const Dashboard = page(() => import('./pages/Dashboard'), 'Dashboard')
const Dataset = page(() => import('./pages/Dataset'), 'Dataset')
const DataQuality = page(() => import('./pages/Dataset'), 'DataQuality')
const Exploratory = page(() => import('./pages/Dataset'), 'Exploratory')
const NeoExplorer = page(() => import('./pages/NeoExplorer'), 'NeoExplorer')
const NeoProfilePage = page(() => import('./pages/NeoProfile'), 'NeoProfilePage')
const FeatureAudit = page(() => import('./pages/FeatureAudit'), 'FeatureAudit')
const ExperimentDesign = page(() => import('./pages/ExperimentDesign'), 'ExperimentDesign')
const Experiments = page(() => import('./pages/Experiments'), 'Experiments')
const ExperimentDetail = page(() => import('./pages/ExperimentDetail'), 'ExperimentDetail')
const ModelComparison = page(() => import('./pages/ModelComparison'), 'ModelComparison')
const CrossValidation = page(() => import('./pages/CrossValidation'), 'CrossValidation')
const ModelPerformance = page(() => import('./pages/ModelPerformance'), 'ModelPerformance')
const ConfusionPage = page(() => import('./pages/Analysis'), 'ConfusionPage')
const RocPage = page(() => import('./pages/Analysis'), 'RocPage')
const PrecisionRecallPage = page(() => import('./pages/Analysis'), 'PrecisionRecallPage')
const ThresholdPage = page(() => import('./pages/Analysis'), 'ThresholdPage')
const CalibrationPage = page(() => import('./pages/Analysis'), 'CalibrationPage')
const ImportancePage = page(() => import('./pages/Interpretability'), 'ImportancePage')
const ShapPage = page(() => import('./pages/Interpretability'), 'ShapPage')
const ErrorsPage = page(() => import('./pages/Interpretability'), 'ErrorsPage')
const AnomalyPage = page(() => import('./pages/Interpretability'), 'AnomalyPage')
const RunInfo = page(() => import('./pages/Reproducibility'), 'RunInfo')
const ProvenancePage = page(() => import('./pages/Reproducibility'), 'ProvenancePage')
const Methodology = page(() => import('./pages/Reproducibility'), 'Methodology')
const Limitations = page(() => import('./pages/Limitations'), 'Limitations')

function NotFound() {
  return (
    <EmptyResearchState title="PAGE NOT FOUND">
      <p>There is no page at this address. Use the navigation to continue.</p>
    </EmptyResearchState>
  )
}

function App() {
  const location = useLocation()

  // Route changes start at the top; in-page anchors (same path) are left alone.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <AppShell>
      {/* Keyed on the path so the CSS enter animation replays on each route change. */}
      <PageTransition key={location.pathname}>
        <Suspense fallback={<LoadingState variant="page" />}>
            <Routes location={location}>
              <Route path="/" element={<Overview />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dataset" element={<Dataset />} />
              <Route path="/data-quality" element={<DataQuality />} />
              <Route path="/exploratory" element={<Exploratory />} />
              <Route path="/explorer" element={<NeoExplorer />} />
              <Route path="/neo/:id" element={<NeoProfilePage />} />
              <Route path="/feature-audit" element={<FeatureAudit />} />
              <Route path="/experiment-design" element={<ExperimentDesign />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/experiments/:experiment/:model" element={<ExperimentDetail />} />
              <Route path="/model-comparison" element={<ModelComparison />} />
              <Route path="/cross-validation" element={<CrossValidation />} />
              <Route path="/original-experiment" element={<ModelPerformance />} />
              <Route path="/analysis/confusion" element={<ConfusionPage />} />
              <Route path="/analysis/roc" element={<RocPage />} />
              <Route path="/analysis/precision-recall" element={<PrecisionRecallPage />} />
              <Route path="/analysis/threshold" element={<ThresholdPage />} />
              <Route path="/analysis/calibration" element={<CalibrationPage />} />
              <Route path="/analysis/importance" element={<ImportancePage />} />
              <Route path="/analysis/shap" element={<ShapPage />} />
              <Route path="/analysis/errors" element={<ErrorsPage />} />
              <Route path="/analysis/anomaly" element={<AnomalyPage />} />
              <Route path="/run-info" element={<RunInfo />} />
              <Route path="/provenance" element={<ProvenancePage />} />
              <Route path="/methodology" element={<Methodology />} />
              <Route path="/limitations" element={<Limitations />} />
              {/* Routes from the previous UI keep working. */}
              <Route path="/data" element={<Navigate to="/dataset" replace />} />
              <Route path="/reproducibility" element={<Navigate to="/run-info" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageTransition>
    </AppShell>
  )
}

export default App
