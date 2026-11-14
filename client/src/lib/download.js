import { api } from './api';

// PDF downloads need the bearer token, so fetch as a blob and save it from memory.
export async function downloadCertificate(certId) {
  const blob = await api.blob(`/certificates/${certId}/download`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${certId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
