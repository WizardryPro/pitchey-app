// File Download Utility
// Handles conversion of R2 URLs to downloadable API endpoints

import { getApiUrl } from '../config';

/**
 * Converts R2 storage URLs to API download endpoints that generate presigned URLs
 * @param url - The original URL (may be R2 format like "r2://pitches/226/script_final.pdf")
 * @param fileName - The file name for fallback
 * @returns Promise that resolves to a downloadable URL
 */
export async function convertToDownloadableUrl(url: string, fileName?: string): Promise<string> {
  // If it's already a proper HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Handle R2 URLs in format: r2://pitches/226/script_final.pdf
  if (url.startsWith('r2://')) {
    try {
      // Extract the storage path from the R2 URL
      const storagePath = url.replace('r2://', '');
      const pathParts = storagePath.split('/');
      
      if (pathParts.length >= 3 && pathParts[0] === 'pitches') {
        const pitchId = pathParts[1];
        const filename = pathParts.slice(2).join('/'); // Handle nested paths
        
        // Use the configured API URL to ensure proper authentication
        const apiBaseUrl = getApiUrl();
        return `${apiBaseUrl}/api/pitches/${pitchId}/attachments/${filename}`;
      }
    } catch (error) {
      console.warn('Failed to convert R2 URL:', url, error);
    }
  }

  // Fallback: return original URL (may not work but won't break the UI)
  return url;
}

/**
 * Handles file download by fetching the presigned URL and opening it
 * @param url - The original URL (R2 or HTTP)
 * @param fileName - The file name for user experience
 */
export async function handleFileDownload(url: string, fileName?: string): Promise<void> {
  try {
    // Convert to downloadable URL if needed
    const downloadUrl = await convertToDownloadableUrl(url, fileName);
    
    // If it's an API endpoint, fetch the presigned URL
    if (downloadUrl.includes('/api/')) {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        credentials: 'include' // Include session cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get download URL: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data?.downloadUrl) {
        // Open the presigned URL for download
        window.open(result.data.downloadUrl, '_blank');
      } else {
        throw new Error(result.error || 'Failed to generate download URL');
      }
    } else {
      // Direct URL, open it
      window.open(downloadUrl, '_blank');
    }
  } catch (error) {
    console.error('Download failed:', error);
    // Show user-friendly error
    alert(`Failed to download ${fileName || 'file'}. Please try again or contact support.`);
  }
}

/**
 * Creates a click handler for file download links
 * @param url - The file URL
 * @param fileName - The file name
 * @returns Click event handler
 */
export function createDownloadClickHandler(url: string, fileName?: string) {
  return (event: React.MouseEvent) => {
    event.preventDefault();
    void handleFileDownload(url, fileName);
  };
}