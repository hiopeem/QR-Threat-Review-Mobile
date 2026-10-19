// Base URL is set at Expo start time via:
//   $env:EXPO_PUBLIC_API_URL="http://<LAN-IP>:3000"; npx expo start
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Posts a decoded URL to the backend for VirusTotal analysis.
//
// IMPORTANT: this function MUST throw on any failure. The caller (QRScannerScreen)
// catches errors and maps them to an 'Error' verdict — it must never silently
// fall back to 'Safe'. Do not add catch blocks here.
export async function verifyUrl(url) {
  const response = await fetch(`${API_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Server error ${response.status}`);
  }

  return response.json();
}
