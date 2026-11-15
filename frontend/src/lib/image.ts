/**
 * Prepara una foto de perfil: recorta en cuadrado, reduce a 400×400 y comprime
 * en JPEG (≈30–60 KB). Se guarda como data URL dentro del documento del CV,
 * así no hace falta Firebase Storage (que es de pago).
 */
export async function resizeImageFile(file: File, max = 400): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen supera los 10 MB.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(max, side);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}
