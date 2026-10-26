const fs = require('fs');
const { execSync } = require('child_process');

if (fs.existsSync('frontend')) {
  console.log('[*] Detected repository root. Building frontend...');
  execSync('cd frontend && npm install && npm run build', { stdio: 'inherit' });
  if (fs.existsSync('frontend/dist')) {
    fs.cpSync('frontend/dist', 'dist', { recursive: true });
    console.log('[+] Copied frontend/dist to root dist folder.');
  }
} else {
  console.log('[*] Detected frontend directory. Building...');
  if (!fs.existsSync('node_modules')) {
    execSync('npm install', { stdio: 'inherit' });
  }
  execSync('npx vite build', { stdio: 'inherit' });
}
