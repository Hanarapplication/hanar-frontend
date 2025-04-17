// Utility hook for simple toast notification
import { useEffect, useState } from 'react';

export function useToast(timeout = 3000) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), timeout);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return {
    toastMessage: message,
    showToast: (msg: string) => setMessage(msg)
  };
}
