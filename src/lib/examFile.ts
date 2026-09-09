import { supabase } from "@/integrations/supabase/client";

const BUCKET = "exams";

export function examFileName(path: string, fallback = "exame") {
  const last = path.split("/").pop()?.split("?")[0];
  return last && last.length > 0 ? last : fallback;
}

/** Abre o arquivo do exame. Path de storage gera link temporário (bucket privado). */
export async function downloadExamFile(path: string, fileName?: string) {
  const name = fileName ?? examFileName(path);

  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    triggerDownload(path, name);
    return;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60, { download: name });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Não foi possível gerar o link do arquivo");
  }
  triggerDownload(data.signedUrl, name);
}

function triggerDownload(href: string, fileName: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
