/**
 * Image Enhancement Utilities for AttendVision
 * Improves lighting conditions for better face recognition
 */

/**
 * Enhance image lighting using histogram equalization
 * This improves contrast and brightness for better recognition
 */
export function enhanceImageLighting(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale and build histogram
  const histogram = new Array(256).fill(0);
  const grayscale = new Uint8ClampedArray(data.length / 4);

  for (let i = 0; i < data.length; i += 4) {
    // Convert RGB to grayscale using luminosity method
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    grayscale[i / 4] = gray;
    histogram[gray]++;
  }

  // Calculate cumulative distribution function (CDF)
  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const totalPixels = canvas.width * canvas.height;
  const cdfMin = cdf.find((val) => val > 0) || 0;

  const lookupTable = new Array(256);
  for (let i = 0; i < 256; i++) {
    lookupTable[i] = Math.round(
      ((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255
    );
  }

  // Apply histogram equalization
  for (let i = 0; i < data.length; i += 4) {
    const gray = grayscale[i / 4];
    const enhanced = lookupTable[gray];

    // Preserve color ratios while enhancing brightness
    const ratio = enhanced / (gray || 1);
    data[i] = Math.min(255, data[i] * ratio); // R
    data[i + 1] = Math.min(255, data[i + 1] * ratio); // G
    data[i + 2] = Math.min(255, data[i + 2] * ratio); // B
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Adjust brightness and contrast
 */
export function adjustBrightnessContrast(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  brightness: number = 10, // -100 to 100
  contrast: number = 10 // -100 to 100
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    // Apply brightness
    data[i] = data[i] + brightness;
    data[i + 1] = data[i + 1] + brightness;
    data[i + 2] = data[i + 2] + brightness;

    // Apply contrast
    data[i] = contrastFactor * (data[i] - 128) + 128;
    data[i + 1] = contrastFactor * (data[i + 1] - 128) + 128;
    data[i + 2] = contrastFactor * (data[i + 2] - 128) + 128;

    // Clamp values
    data[i] = Math.max(0, Math.min(255, data[i]));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Detect if image is too dark or too bright
 */
export function analyzeLighting(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): {
  averageBrightness: number;
  isTooDark: boolean;
  isTooBright: boolean;
  needsEnhancement: boolean;
  recommendation: string;
} {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let totalBrightness = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;
  }

  const averageBrightness = totalBrightness / pixelCount;
  const isTooDark = averageBrightness < 80;
  const isTooBright = averageBrightness > 200;

  let recommendation = "Lighting is good";
  if (isTooDark) {
    recommendation = "Move to a brighter area or turn on more lights";
  } else if (isTooBright) {
    recommendation = "Reduce direct light or move away from bright background";
  }

  return {
    averageBrightness,
    isTooDark,
    isTooBright,
    needsEnhancement: isTooDark || isTooBright,
    recommendation,
  };
}
