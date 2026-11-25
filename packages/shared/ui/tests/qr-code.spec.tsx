import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { generateQrMatrix, QrCodeSvg } from '../src';

function assertFinderPattern(modules: readonly (readonly boolean[])[], row0: number, col0: number) {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      expect(modules[row0 + r]?.[col0 + c]).toBe(isOuter || isInner);
    }
  }
}

describe('@aklapper/ui QrCodeSvg & qrMatrix', () => {
  it('encodes short, 120-char, and 240-char otpauth URIs with valid square geometry, finder patterns, and version info', () => {
    const uri120 =
      'otpauth://totp/andrew-k.us%20Admin:admin?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=andrew-k.us+Admin&algorithm=SHA1&digits=6&period=30';
    expect(uri120.length).toBeGreaterThanOrEqual(120);

    const matrix120 = generateQrMatrix(uri120);
    expect(matrix120.version).toBeGreaterThanOrEqual(6);
    expect(matrix120.size).toBe(matrix120.version * 4 + 17);
    expect(matrix120.modules).toHaveLength(matrix120.size);
    assertFinderPattern(matrix120.modules, 0, 0);
    assertFinderPattern(matrix120.modules, 0, matrix120.size - 7);
    assertFinderPattern(matrix120.modules, matrix120.size - 7, 0);
    expect(matrix120.modules[matrix120.size - 8]?.[8]).toBe(true);

    const longHandle = 'admin-operator-with-very-long-account-handle-'.repeat(3);
    const uri240 = `otpauth://totp/andrew-k.us%20Admin:${longHandle}?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=andrew-k.us+Admin&algorithm=SHA1&digits=6&period=30`;
    expect(uri240.length).toBeGreaterThanOrEqual(240);

    const matrix240 = generateQrMatrix(uri240);
    expect(matrix240.version).toBeGreaterThanOrEqual(11);
    expect(matrix240.size).toBe(matrix240.version * 4 + 17);
    assertFinderPattern(matrix240.modules, 0, 0);
    assertFinderPattern(matrix240.modules, 0, matrix240.size - 7);
    assertFinderPattern(matrix240.modules, matrix240.size - 7, 0);
    // Version >= 7 dark module, timing patterns, and mirrored format strips match
    expect(matrix240.modules[matrix240.size - 8]?.[8]).toBe(true);
    for (let i = 8; i < matrix240.size - 8; i += 1) {
      expect(matrix240.modules[6]?.[i]).toBe(i % 2 === 0);
      expect(matrix240.modules[i]?.[6]).toBe(i % 2 === 0);
    }
    for (let i = 0; i < 6; i += 1) {
      expect(matrix240.modules[8]?.[i]).toBe(matrix240.modules[matrix240.size - 1 - i]?.[8]);
      expect(matrix240.modules[i]?.[8]).toBe(matrix240.modules[8]?.[matrix240.size - 1 - i]);
    }
  });

  it('rejects empty and oversized inputs loudly', () => {
    expect(() => generateQrMatrix('')).toThrow(/non-empty/i);
    expect(() => generateQrMatrix('a'.repeat(700))).toThrow(/capacity/i);
  });

  it('renders an accessible high-contrast inline SVG without external network requests', () => {
    const uri =
      'otpauth://totp/andrew-k.us%20Admin:admin?secret=JBSWY3DPEHPK3PXP&issuer=andrew-k.us+Admin';
    const { container } = render(
      <QrCodeSvg value={uri} size={184} label='TOTP Authenticator QR Code' />,
    );

    const img = screen.getByRole('img', { name: 'TOTP Authenticator QR Code' });
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img.getAttribute('width')).toBe('184');
    expect(img.getAttribute('height')).toBe('184');

    const viewBox = img.getAttribute('viewBox') ?? '';
    expect(viewBox).toMatch(/^0 0 \d+ \d+$/);

    const bgRect = container.querySelector('rect');
    const modulesPath = container.querySelector('path');
    expect(bgRect?.getAttribute('fill')).toBe('#ffffff');
    expect(modulesPath?.getAttribute('fill')).toBe('#000000');
    expect(modulesPath?.getAttribute('d')?.length).toBeGreaterThan(20);
    expect(container.querySelector('img')).toBeNull();
  });
});
