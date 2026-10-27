export const PROGRESS_REACTIONS = ['💪','🔥','❤️','👏','👍','💯'];
export const validProgressImage = value => typeof value === 'string' && value.length <= 240000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
export async function prepareProgressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP under 10 MB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.82, .65, .45, .3]) { const result = canvas.toDataURL('image/jpeg', quality); if (validProgressImage(result)) return result; }
    throw new Error('Try a smaller picture.');
  } finally { bitmap.close(); }
}
