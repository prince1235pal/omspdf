const fs = require('fs');
const path = require('path');

// Directory paths
const buildDir = path.join(__dirname, 'build');
const dirs = ['css', 'js', 'img', 'output'];
const files = ['index.html', 'server.js', 'package.json'];

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  console.log('Creating build directory...');
  fs.mkdirSync(buildDir);
}

// Copy directories
dirs.forEach(dir => {
  const srcDir = path.join(__dirname, dir);
  const destDir = path.join(buildDir, dir);
  
  if (fs.existsSync(srcDir)) {
    console.log(`Copying directory: ${dir}`);
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const items = fs.readdirSync(srcDir);
    
    items.forEach(item => {
      const srcPath = path.join(srcDir, item);
      const destPath = path.join(destDir, item);
      
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }
});

// Copy individual files
files.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(buildDir, file);
  
  if (fs.existsSync(srcPath)) {
    console.log(`Copying file: ${file}`);
    fs.copyFileSync(srcPath, destPath);
  }
});

console.log('Build completed successfully!'); 