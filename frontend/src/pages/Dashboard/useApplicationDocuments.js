import { useEffect, useState } from 'react'
import { apiFetch } from '../auth'

export default function useApplicationDocuments(applicationId) {
  const [documents, setDocuments] = useState({})
  const [paymentReceipt, setPaymentReceipt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadDocuments() {
      setIsLoading(true)
      setError('')
      try {
        const response = await apiFetch(`/api/applications/${applicationId}/documents`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load application documents.')
        setDocuments(result.documents || {})
        setPaymentReceipt(result.paymentReceipt || '')
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message || 'Unable to load application documents.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadDocuments()
    return () => {
      controller.abort()
    }
  }, [applicationId])

  return { documents, paymentReceipt, isLoading, error }
}
