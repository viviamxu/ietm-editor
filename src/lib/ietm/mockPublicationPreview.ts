/** 弹框 mock 插图预览：内联 SVG，不依赖外网 CDN。 */
export function mockPublicationPreviewDataUrl(
  seed: number,
  width = 300,
  height = 200,
): string {
  const hues = [210, 160, 280, 25, 340, 190, 120, 45];
  const hue = hues[Math.abs(seed) % hues.length];
  const label = String(Math.abs(seed));
  const innerW = Math.max(40, width - 40);
  const innerH = Math.max(40, height - 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect fill="hsl(${hue} 55% 92%)" width="100%" height="100%"/>
  <rect fill="hsl(${hue} 48% 78%)" x="20" y="20" width="${innerW}" height="${innerH}" rx="8"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="hsl(${hue} 32% 24%)" font-family="system-ui,sans-serif" font-size="16">演示 ${label}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
