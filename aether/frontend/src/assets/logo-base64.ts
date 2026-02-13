/**
 * Aether Logo - Base64 Encoded SVG
 * High-resolution logo for PDF generation
 */

// Simple Aether logo - black text "aether." in clean sans-serif font
const AETHER_LOGO_SVG = `
<svg width="100" height="30" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg">
  <!-- Text: aether. (matching brand identity) -->
  <text x="5" y="22" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="20" font-weight="400" fill="#000000">aether.</text>
</svg>
`;

// Convert SVG to base64
export const AETHER_LOGO_BASE64 = `data:image/svg+xml;base64,${btoa(AETHER_LOGO_SVG)}`;

// Alternative: PNG placeholder if SVG doesn't work in PDF
// This is a minimal 1x1 transparent PNG as fallback
export const AETHER_LOGO_PNG_FALLBACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export default AETHER_LOGO_BASE64;
