'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const redirectTo = localStorage.getItem('hanar_redirect_after_auth') || '/'
    localStorage.removeItem('hanar_redirect_after_auth')
    router.push(redirectTo)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center text-lg text-gray-700">
      Signing you in...
    </div>
  )
}
