import { Route, Routes } from 'react-router-dom'
import { Nav } from './components/Nav'
import { Overview } from './pages/Overview'
import { Dataset } from './pages/Dataset'
import { Explore } from './pages/Explore'
import { Experiments } from './pages/Experiments'
import { NeoExplorer } from './pages/NeoExplorer'
import { NeoProfile } from './pages/NeoProfile'
import { ModelPerformance } from './pages/ModelPerformance'
import { Explainability } from './pages/Explainability'
import { ErrorAnalysis } from './pages/ErrorAnalysis'
import { Anomalies } from './pages/Anomalies'
import { Methodology } from './pages/Methodology'
import { Limitations } from './pages/Limitations'

function App() {
  return (
    <div className="min-h-screen bg-[#05070d]">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/dataset" element={<Dataset />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/models" element={<ModelPerformance />} />
          <Route path="/explainability" element={<Explainability />} />
          <Route path="/errors" element={<ErrorAnalysis />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/explorer" element={<NeoExplorer />} />
          <Route path="/neo/:id" element={<NeoProfile />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/limitations" element={<Limitations />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
