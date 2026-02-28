import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AbstractWalletProvider } from '@abstract-foundation/agw-react'
import { abstract } from 'viem/chains'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AbstractWalletProvider chain={abstract}>
      <App />
    </AbstractWalletProvider>
  </StrictMode>,
)
