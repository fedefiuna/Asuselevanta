/**
 * Reduce una foto antes de enviarla: lado mayor 1280 px y JPEG calidad 0.72.
 * Una foto de celular (3-8 MB) queda en ~150-400 KB, lo que mantiene liviana la base de datos.
 */
export function compressImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
    };
    img.src = url;
  });
}
