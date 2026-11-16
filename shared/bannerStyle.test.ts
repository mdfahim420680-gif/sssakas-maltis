import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGradientCss,
  buildOverlayCss,
  createDefaultBannerStyleConfig,
  DEFAULT_HERO_SLIDER_CONFIG,
  hexToRgba,
  mergeBannerStyleConfig,
  normalizeHeroSliderConfig,
  resolveBannerMinHeight,
  resolveImageObjectPosition,
} from './bannerStyle';

test('mergeBannerStyleConfig preserves theme presets and clamps numeric bounds', () => {
  const merged = mergeBannerStyleConfig('purple', {
    gradientAngle: 720,
    overlayOpacity: -20,
    imageScale: 5,
    imageRotation: -99,
    borderRadius: 120,
  });

  assert.equal(merged.textColor, '#FFFFFF');
  assert.equal(merged.gradientAngle, 360);
  assert.equal(merged.overlayOpacity, 0);
  assert.equal(merged.imageScale, 1.5);
  assert.equal(merged.imageRotation, -15);
  assert.equal(merged.borderRadius, 48);
});

test('buildGradientCss generates linear and radial CSS gradients from stops', () => {
  const style = createDefaultBannerStyleConfig('indigo');
  style.gradientType = 'linear';
  style.gradientAngle = 90;
  style.gradientStops = [
    { color: '#071636', position: 0 },
    { color: '#0D63F3', position: 60 },
    { color: '#38BDF8', position: 100 },
  ];

  const linear = buildGradientCss(style);
  assert.equal(linear, 'linear-gradient(90deg, #071636 0%, #0D63F3 60%, #38BDF8 100%)');

  style.gradientType = 'radial';
  const radial = buildGradientCss(style);
  assert.equal(radial, 'radial-gradient(circle at center, #071636 0%, #0D63F3 60%, #38BDF8 100%)');
});

test('buildOverlayCss & hexToRgba produce deterministic RGBA overlays', () => {
  assert.equal(hexToRgba('#0D63F3', 0.5), 'rgba(13, 99, 243, 0.50)');
  assert.equal(hexToRgba('#fff', 0.25), 'rgba(255, 255, 255, 0.25)');

  const style = createDefaultBannerStyleConfig('sky');
  assert.equal(buildOverlayCss(style), undefined);

  style.overlayMode = 'solid';
  style.overlayColor = '#071636';
  style.overlayOpacity = 60;
  assert.equal(buildOverlayCss(style), 'rgba(7, 22, 54, 0.60)');

  style.overlayMode = 'gradient';
  style.overlayAngle = 180;
  const gradOverlay = buildOverlayCss(style);
  assert.ok(gradOverlay?.startsWith('linear-gradient(180deg, rgba(7, 22, 54, 0.60) 0%,'));
});

test('resolveImageObjectPosition & resolveBannerMinHeight respect desktop and mobile overrides', () => {
  const style = createDefaultBannerStyleConfig('mint');
  style.imagePosition = 'custom';
  style.imagePosX = 25;
  style.imagePosY = 75;
  assert.equal(resolveImageObjectPosition(style), '25% 75%');

  style.heightPreset = 'lg';
  style.mobileHeightPreset = 'sm';
  assert.equal(resolveBannerMinHeight(style, 'promo_trio', false), '240px');
  assert.equal(resolveBannerMinHeight(style, 'promo_trio', true), '145px');

  style.heightPreset = 'custom';
  style.customHeight = '310px';
  style.mobileHeightPreset = 'inherit';
  assert.equal(resolveBannerMinHeight(style, 'seasonal_strip', false), '310px');
});

test('normalizeHeroSliderConfig validates bounds and defaults', () => {
  const normalized = normalizeHeroSliderConfig({
    autoplay: false,
    slideDurationMs: 500,
    transitionType: 'fade',
    transitionDurationMs: 4000,
    showArrows: false,
  });

  assert.equal(normalized.autoplay, false);
  assert.equal(normalized.slideDurationMs, 2000);
  assert.equal(normalized.transitionType, 'fade');
  assert.equal(normalized.transitionDurationMs, 1500);
  assert.equal(normalized.showArrows, false);
  assert.equal(normalized.loop, DEFAULT_HERO_SLIDER_CONFIG.loop);
});
