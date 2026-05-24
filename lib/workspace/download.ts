import { API_BASE_URL } from "@/lib/api";

type DownloadFileParams = {
  token: string;
  downloadPath: string;
  fileName: string;
  errorMessage?: string;
};

export async function downloadFileWithToken({
  token,
  downloadPath,
  fileName,
  errorMessage = "Unable to download file",
}: DownloadFileParams) {
  const response = await fetch(`${API_BASE_URL}${downloadPath}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
