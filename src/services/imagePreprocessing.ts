/**
 * Image Pre-Processing Engine for Optical Character Recognition (OCR)
 * Optimizes passport, ID card (cédula), and carnet photos for maximum OCR precision.
 * Removes shadows, enhances contrast, and binarizes text lines for accurate character reading.
 */

export interface PreprocessedImages {
  original: string;
  enhanced: string; // Grayscale + Contrast stretched + Sharpened
  binarized: string; // High contrast black & white (ideal for MRZ and card numbers)
}

/**
 * Loads an image from a Data URI into an HTMLImageElement
 */
function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUri;
  });
}

/**
 * Preprocesses an image with optical filters to maximize OCR recognition accuracy.
 */
export async function preprocessDocumentForOCR(imageDataUri: string): Promise<PreprocessedImages> {
  try {
    const img = await loadImage(imageDataUri);

    // Limit maximum dimension for speed while preserving high resolution (1800px is sweet spot for OCR)
    const maxDim = 1920;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    // 1. Create Base Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        original: imageDataUri,
        enhanced: imageDataUri,
        binarized: imageDataUri,
      };
    }

    ctx.drawImage(img, 0, 0, width, height);
    const originalResized = canvas.toDataURL('image/jpeg', 0.95);

    // Get Pixel Data
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    // Pass 1: Convert to Grayscale & Find Min/Max Luminance for Contrast Stretching
    let minLum = 255;
    let maxLum = 0;
    const grayscale = new Uint8ClampedArray(width * height);

    for (let i = 0, p = 0; i < len; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceptual luminance formula (ITU-R BT.601)
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      grayscale[p] = lum;

      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    // Avoid division by zero
    const lumRange = maxLum > minLum ? maxLum - minLum : 1;

    // 2. Build Enhanced Image (Grayscale + Contrast Stretching)
    const enhancedImgData = ctx.createImageData(width, height);
    const enhData = enhancedImgData.data;

    for (let p = 0, i = 0; p < grayscale.length; p++, i += 4) {
      // Linear contrast stretching: maps [minLum, maxLum] to [0, 255]
      let stretched = Math.round(((grayscale[p] - minLum) / lumRange) * 255);
      // Slight gamma correction to darken letters
      stretched = Math.round(255 * Math.pow(stretched / 255, 1.15));

      enhData[i] = stretched;
      enhData[i + 1] = stretched;
      enhData[i + 2] = stretched;
      enhData[i + 3] = 255;
    }

    // Apply sharpening convolution to enhanced
    const sharpenedData = applySharpen(enhData, width, height);
    for (let i = 0; i < len; i++) {
      enhData[i] = sharpenedData[i];
    }

    ctx.putImageData(enhancedImgData, 0, 0);
    const enhancedDataUri = canvas.toDataURL('image/jpeg', 0.95);

    // 3. Build Binarized Image (Otsu Thresholding)
    // Otsu method finds the global threshold that minimizes intra-class variance
    const threshold = calculateOtsuThreshold(grayscale);

    const binarizedImgData = ctx.createImageData(width, height);
    const binData = binarizedImgData.data;

    for (let p = 0, i = 0; p < grayscale.length; p++, i += 4) {
      const val = grayscale[p] < threshold ? 0 : 255;
      binData[i] = val;
      binData[i + 1] = val;
      binData[i + 2] = val;
      binData[i + 3] = 255;
    }

    ctx.putImageData(binarizedImgData, 0, 0);
    const binarizedDataUri = canvas.toDataURL('image/png');

    return {
      original: originalResized,
      enhanced: enhancedDataUri,
      binarized: binarizedDataUri,
    };
  } catch (err) {
    console.warn('Image preprocessing warning:', err);
    return {
      original: imageDataUri,
      enhanced: imageDataUri,
      binarized: imageDataUri,
    };
  }
}

/**
 * Calculates Otsu's optimal threshold for image binarization
 */
function calculateOtsuThreshold(grayscale: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  const total = grayscale.length;

  for (let i = 0; i < total; i++) {
    histogram[grayscale[i]]++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) {
    sum += t * histogram[t];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varianceBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = t;
    }
  }

  // Cap threshold to avoid over-darkening or over-whitening
  return Math.max(70, Math.min(threshold, 190));
}

/**
 * 3x3 Sharpening kernel
 */
function applySharpen(
  src: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  // Copy alpha
  for (let i = 3; i < src.length; i += 4) {
    dst[i] = 255;
  }

  // Kernel:
  //  0  -1   0
  // -1   5  -1
  //  0  -1   0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      const val =
        src[idx] * 5 -
        (src[top] + src[bottom] + src[left] + src[right]);

      const clamped = Math.max(0, Math.min(255, val));
      dst[idx] = clamped;
      dst[idx + 1] = clamped;
      dst[idx + 2] = clamped;
    }
  }

  return dst;
}

export async function rotateImage(dataUri: string): Promise<string> {
  const image = await loadImage(dataUri);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalHeight; canvas.height = image.naturalWidth;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo girar la imagen.');
  context.translate(canvas.width, 0); context.rotate(Math.PI / 2);
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.94);
}
