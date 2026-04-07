'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';

interface ApiError {
  message: string;
  code?: string;
}

/**
 * Hook for standardized API error handling with toast notifications
 */
export function useApiError() {
  const handleError = useCallback((error: unknown, customMessage?: string) => {
    let message = customMessage || 'An error occurred';
    
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const apiError = error as ApiError;
      message = apiError.message || customMessage || 'An error occurred';
    }
    
    // Log to console for debugging
    console.error('[API Error]', error);
    
    // Show toast notification
    toast.error(message);
    
    return message;
  }, []);

  const handleSuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const handleLoading = useCallback((message: string = 'Loading...') => {
    return toast.loading(message);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    toast.dismiss(toastId);
  }, []);

  return {
    handleError,
    handleSuccess,
    handleLoading,
    dismissToast,
  };
}

// Utility function for non-hook usage
export function showError(message: string) {
  toast.error(message);
}

export function showSuccess(message: string) {
  toast.success(message);
}

export function showLoading(message: string = 'Loading...') {
  return toast.loading(message);
}
