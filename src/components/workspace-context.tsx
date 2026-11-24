import { createContext, useContext } from 'react'

export const DemoContext = createContext(false)
export function useWorkspace() {
  const demo = useContext(DemoContext)
  return { demo, basePath: demo ? '/demo' : '/incidents', actionBase: demo ? '/api/demo/actions' : '/api/actions' }
}
