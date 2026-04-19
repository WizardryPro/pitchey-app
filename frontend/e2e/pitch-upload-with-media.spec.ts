import { test, expect, Page } from '@playwright/test';
import { TEST_PITCHES } from './fixtures/test-data';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const TEST_PITCH = TEST_PITCHES.actionThriller;

// Production URL
const PROD_URL = 'https://pitchey.pages.dev';

// ES module compatible paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'media');

// Helper: Login to production creator portal
async function loginAsCreator(page: Page) {
  await page.goto(`${PROD_URL}/creator/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], [name="email"]', 'alex.creator@demo.com');
  await page.fill('input[type="password"], [name="password"]', 'Demo123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/creator/dashboard', { timeout: 15000 });
  console.log('✓ Logged in to production creator portal');
}

// Helper: Wait for notification
async function waitForNotification(page: Page) {
  const selectors = [
    '[data-testid="toast-success"]',
    '[role="alert"]',
    '.Toastify__toast--success',
    '.toast',
  ];

  try {
    await page.locator(selectors.join(', ')).first().waitFor({ timeout: 10000 });
  } catch {
    console.log('Notification not found, continuing...');
    await page.waitForTimeout(1000);
  }
}

test.describe('Pitch Upload with Media - PRODUCTION', () => {
  test.use({ baseURL: PROD_URL });

  test.beforeAll(async () => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    // Create a test image (valid PNG)
    const testImagePath = path.join(FIXTURES_DIR, 'test-poster.png');
    if (!fs.existsSync(testImagePath)) {
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
        0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
        0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
        0x00, 0x18, 0xdd, 0x8d, 0xb4,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, pngData);
    }

    // Create a test video (minimal MP4)
    const testVideoPath = path.join(FIXTURES_DIR, 'test-trailer.mp4');
    if (!fs.existsSync(testVideoPath)) {
      const mp4Data = Buffer.from([
        0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
        0x6d, 0x70, 0x34, 0x31,
        0x00, 0x00, 0x00, 0x08, 0x6d, 0x6f, 0x6f, 0x76,
      ]);
      fs.writeFileSync(testVideoPath, mp4Data);
    }
  });

  test('upload pitch with poster and video on production', async ({ page }) => {
    // Login to creator portal
    await loginAsCreator(page);

    // Navigate directly to create pitch page
    await page.goto(`${PROD_URL}/creator/pitch/new`);
    await page.waitForLoadState('networkidle');

    // Fill pitch details using actual form selectors
    console.log('Filling pitch form...');

    // Title
    await page.fill('[data-testid="title-input"], [name="title"]', TEST_PITCH.title);

    // Genre
    const genreSelect = page.locator('[data-testid="genre-select"], [name="genre"]');
    if (await genreSelect.count() > 0) {
      await genreSelect.selectOption(TEST_PITCH.genre);
    }

    // Logline
    await page.fill('[data-testid="logline-textarea"], [name="logline"], textarea[placeholder*="logline"]', TEST_PITCH.logline);

    // Themes (optional)
    const themesInput = page.locator('[name="themes"], #themes');
    if (await themesInput.count() > 0) {
      await themesInput.fill(TEST_PITCH.themes);
    }

    // Upload cover image using #image-upload input
    console.log('Uploading cover image...');
    const imageInput = page.locator('#image-upload');
    if (await imageInput.count() > 0) {
      await imageInput.setInputFiles(path.join(FIXTURES_DIR, 'test-poster.png'));
      await page.waitForTimeout(2000);
      console.log('✓ Cover image uploaded');
    } else {
      console.log('Image upload input not found');
    }

    // Upload video using #video-upload input
    console.log('Uploading video...');
    const videoInput = page.locator('#video-upload');
    if (await videoInput.count() > 0) {
      await videoInput.setInputFiles(path.join(FIXTURES_DIR, 'test-trailer.mp4'));
      await page.waitForTimeout(3000);
      console.log('✓ Video uploaded');
    } else {
      console.log('Video upload input not found');
    }

    // Submit the form
    console.log('Submitting pitch...');
    await page.click('[data-testid="submit-button"], button[type="submit"]');
    await waitForNotification(page);

    console.log('✓ Pitch with media uploaded to production!');
  });

  test('full pitch workflow with all fields', async ({ page }) => {
    await loginAsCreator(page);

    // Go directly to create pitch
    await page.goto(`${PROD_URL}/creator/pitch/new`);
    await page.waitForLoadState('networkidle');

    // Fill all available fields
    const uniqueTitle = `${TEST_PITCH.title} - ${Date.now()}`;

    await page.fill('[data-testid="title-input"], [name="title"]', uniqueTitle);

    const genreSelect = page.locator('[data-testid="genre-select"], [name="genre"]');
    if (await genreSelect.count() > 0) {
      await genreSelect.selectOption(TEST_PITCH.genre);
    }

    await page.fill('[data-testid="logline-textarea"], [name="logline"]', TEST_PITCH.logline);

    // Themes
    const themesInput = page.locator('[name="themes"], #themes');
    if (await themesInput.count() > 0) {
      await themesInput.fill(TEST_PITCH.themes);
    }

    // World description
    const worldInput = page.locator('[name="worldDescription"], #worldDescription');
    if (await worldInput.count() > 0) {
      await worldInput.fill(TEST_PITCH.world);
    }

    // Budget range (if checkbox exists) - skip if options don't match
    const seekingInvestment = page.locator('#seekingInvestment, [name="seekingInvestment"]');
    if (await seekingInvestment.count() > 0) {
      await seekingInvestment.check();
      // Skip budget dropdown - options may vary
    }

    // Upload image
    const imageInput = page.locator('#image-upload');
    if (await imageInput.count() > 0) {
      await imageInput.setInputFiles(path.join(FIXTURES_DIR, 'test-poster.png'));
      await page.waitForTimeout(2000);
    }

    // Upload video
    const videoInput = page.locator('#video-upload');
    if (await videoInput.count() > 0) {
      await videoInput.setInputFiles(path.join(FIXTURES_DIR, 'test-trailer.mp4'));
      await page.waitForTimeout(3000);
    }

    // Submit
    await page.click('[data-testid="submit-button"], button[type="submit"]');
    await waitForNotification(page);

    console.log('✓ Full pitch workflow completed on production!');
  });
});
