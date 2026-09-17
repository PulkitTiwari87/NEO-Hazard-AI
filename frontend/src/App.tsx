import { Route, Routes } from 'react-router-dom'
import { Nav } from './components/Nav'
import { Overview } from './pages/Overview'
import { DataProvenance } from './pages/DataProvenance'
import { NeoExplorer } from './pages/NeoExplorer'
import { ModelPerformance } from './pages/ModelPerformance'
import { FeatureAudit } from './pages/FeatureAudit'
import { Experiments } from './pages/Experiments'
import { ExperimentDetail } from './pages/ExperimentDetail'
import { Reproducibility } from './pages/Reproducibility'
import { Limitations } from './pages/Limitations'

function App() {
  return (
    <div className="min-h-screen bg-[#05070d]">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/data" element={<DataProvenance />} />
          <Route path="/explorer" element={<NeoExplorer />} />
          <Route path="/feature-audit" element={<FeatureAudit />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/experiments/:experiment/:model" element={<ExperimentDetail />} />
          <Route path="/original-experiment" element={<ModelPerformance />} />
          <Route path="/reproducibility" element={<Reproducibility />} />
          <Route path="/limitations" element={<Limitations />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
