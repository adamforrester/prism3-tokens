const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Plugin code build config
// Using es2017 to transpile optional chaining (?.) which Figma's sandbox may not support
const pluginConfig = {
  entryPoints: ['src/plugin/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2017',
  sourcemap: false,
  minify: !isWatch,
};

// UI build config - bundles JS and inlines CSS into HTML
const uiConfig = {
  entryPoints: ['src/ui/main.ts'],
  bundle: true,
  outfile: 'dist/ui.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: false,
  minify: !isWatch,
};

// Build HTML with inlined CSS and JS
async function buildUI() {
  // Read the HTML template
  const htmlTemplate = fs.readFileSync('src/ui/index.html', 'utf8');

  // Read and combine CSS files
  const cssDir = 'src/ui/styles';
  const cssFiles = ['tokens.css', 'base.css', 'components.css'];
  let combinedCSS = '';

  for (const file of cssFiles) {
    const cssPath = path.join(cssDir, file);
    if (fs.existsSync(cssPath)) {
      combinedCSS += fs.readFileSync(cssPath, 'utf8') + '\n';
    }
  }

  // Read the bundled JS
  const bundledJS = fs.existsSync('dist/ui.js')
    ? fs.readFileSync('dist/ui.js', 'utf8')
    : '';

  // Inject CSS and JS into HTML
  let finalHTML = htmlTemplate
    .replace('/* __INJECTED_CSS__ */', combinedCSS)
    .replace('/* __INJECTED_JS__ */', bundledJS);

  // Write final HTML
  fs.writeFileSync('dist/ui.html', finalHTML);
  console.log('Built dist/ui.html');
}

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

async function build() {
  try {
    // Build plugin code
    await esbuild.build(pluginConfig);
    console.log('Built dist/code.js');

    // Build UI JS
    await esbuild.build(uiConfig);
    console.log('Built dist/ui.js');

    // Build final HTML with inlined assets
    await buildUI();

    // Clean up intermediate ui.js file
    if (fs.existsSync('dist/ui.js')) {
      fs.unlinkSync('dist/ui.js');
    }

    console.log('Build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  // Watch plugin code
  const pluginCtx = await esbuild.context(pluginConfig);
  await pluginCtx.watch();
  console.log('Watching plugin code...');

  // Watch UI JS
  const uiCtx = await esbuild.context({
    ...uiConfig,
    plugins: [{
      name: 'rebuild-html',
      setup(build) {
        build.onEnd(async () => {
          await buildUI();
          // Clean up intermediate ui.js
          if (fs.existsSync('dist/ui.js')) {
            fs.unlinkSync('dist/ui.js');
          }
        });
      }
    }]
  });
  await uiCtx.watch();
  console.log('Watching UI code...');

  // Watch CSS and HTML files
  const watchPaths = [
    'src/ui/styles',
    'src/ui/index.html'
  ];

  for (const watchPath of watchPaths) {
    if (fs.existsSync(watchPath)) {
      fs.watch(watchPath, { recursive: true }, async (eventType, filename) => {
        console.log(`File changed: ${filename}`);
        await buildUI();
      });
    }
  }

  console.log('Watching CSS and HTML files...');
  console.log('Press Ctrl+C to stop watching.');
}

if (isWatch) {
  watch();
} else {
  build();
}
