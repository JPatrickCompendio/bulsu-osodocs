/**
 * Compress and downscale images on the browser using HTML Canvas before uploading to Supabase Storage.
 * Reduces 5MB–15MB high-res images down to ~150KB–350KB WebP/JPEG files (90%+ egress savings).
 *
 * @param {File} file - Original uploaded image file
 * @param {Object} options
 * @param {number} [options.maxWidth=1600] - Maximum width in pixels
 * @param {number} [options.maxHeight=1600] - Maximum height in pixels
 * @param {number} [options.quality=0.82] - Image compression quality (0 to 1)
 * @param {string} [options.outputType='image/webp'] - Output MIME type ('image/webp' or 'image/jpeg')
 * @returns {Promise<File>} Compressed File object ready for upload
 */
export async function compressImage(file, options = {}) {
  if (!file || !(file instanceof File)) return file;

  // Only compress raster images (skip PDFs, SVGs, GIFs)
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // If file is already smaller than 250KB, don't re-compress
  if (file.size < 250 * 1024) {
    return file;
  }

  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality ?? 0.82;
  const outputType = options.outputType || 'image/webp';

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let { width, height } = img;

        // Calculate aspect ratio downscaling
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If blob creation fails or doesn't shrink size, return original file
              resolve(file);
              return;
            }

            const extension = outputType === 'image/webp' ? '.webp' : '.jpg';
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const newFileName = `${baseName}${extension}`;

            const compressedFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}
