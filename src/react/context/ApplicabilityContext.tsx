import { createContext, useContext, type PropsWithChildren } from 'react'

export interface ApplicabilityState {
  activePlatform: string
  showOnlyApplicable: boolean
}

const ApplicabilityContext = createContext<ApplicabilityState>({
  activePlatform: 'A320',
  showOnlyApplicable: false,
})

interface ApplicabilityProviderProps extends PropsWithChildren {
  value: ApplicabilityState
}

export function ApplicabilityProvider({
  value,
  children,
}: ApplicabilityProviderProps) {
  return (
    <ApplicabilityContext.Provider value={value}>
      {children}
    </ApplicabilityContext.Provider>
  )
}

export function useApplicabilityContext() {
  return useContext(ApplicabilityContext)
}
