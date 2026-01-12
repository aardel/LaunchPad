const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/renderer/index.html');

try {
    let content = fs.readFileSync(indexPath, 'utf8');
    // Remove crossorigin attribute from script and link tags
    content = content.replace(/crossorigin/g, '');
    // Also sometimes src="./assets/" needs to be checked, but base: './' in vite config should handle it.
    fs.writeFileSync(indexPath, content);
    console.log('Successfully removed crossorigin attributes from index.html');
} catch (err) {
    console.error('Error fixing index.html:', err);
    process.exit(1);
}
