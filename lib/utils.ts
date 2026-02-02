import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the user type from localStorage
 * Returns 'business', 'individual', or 'organization'
 * Falls back to 'individual' if not set
 */
export function getUserType(): 'business' | 'individual' | 'organization' {
  if (typeof window === 'undefined') return 'individual'
  
  const userType = localStorage.getItem('userType')
  if (userType === 'business' || userType === 'organization' || userType === 'individual') {
    return userType
  }
  
  return 'individual'
}