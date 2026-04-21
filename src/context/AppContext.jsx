import { createContext, useContext, useReducer } from 'react'

const AppContext = createContext(null)

const initial = {
  crtMode: false,
  crtVariant: 'green',   // 'green' | 'amber' | 'nightvision' | 'flir'
}

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_CRT':       return { ...state, crtMode: !state.crtMode }
    case 'SET_CRT_VARIANT':  return { ...state, crtVariant: action.variant }
    default:                 return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp() must be used inside <AppProvider>. Check for Vite HMR issues — restart the dev server.')
  return ctx
}
