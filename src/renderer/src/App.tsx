import React, { useState, useEffect } from 'react'
import { AppProvider } from './context/AppContext'
import { WallCanvas } from './wall/WallCanvas'
import { ControlDashboard } from './control/ControlDashboard'

function getWindowView(): 'wall' | 'control' {
  const hash = window.location.hash.toLowerCase()
  const search = window.location.search.toLowerCase()
  if (hash.includes('wall') || search.includes('window=wall')) {
    return 'wall'
  }
  return 'control'
}

export default function App(): React.JSX.Element {
  const [view, setView] = useState<'wall' | 'control'>(getWindowView())

  useEffect(() => {
    const handleHashChange = (): void => {
      setView(getWindowView())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return <AppProvider>{view === 'wall' ? <WallCanvas /> : <ControlDashboard />}</AppProvider>
}
