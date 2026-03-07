const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverFile, 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(line => line.includes('async function requireAuth(req, res, next) {'));
const endIndexDeleteUsers = lines.findIndex(line => line.includes('app.delete(\'/api/users/:id\''));

if (startIndex === -1 || endIndexDeleteUsers === -1) {
    console.error("Could not find start or end indices:", startIndex, endIndexDeleteUsers);
    process.exit(1);
}

// Find the end of the delete block
let endIndex = endIndexDeleteUsers;
while (endIndex < lines.length && !lines[endIndex].startsWith('});')) {
    endIndex++;
}

console.log(`Slicing from line ${startIndex + 1} to ${endIndex + 1}`);

const before = lines.slice(0, startIndex);
const after = lines.slice(endIndex + 1);

const newLines = [
    "// Extracted Routers",
    "const authRoutes = require('./src/routes/auth');",
    "const userRoutes = require('./src/routes/users');",
    "const remarksRoutes = require('./src/routes/remarks');",
    "const locationsRoutes = require('./src/routes/locations');",
    "",
    "// Mount API Routes",
    "app.use('/api', authRoutes); // /api/me mounts here",
    "app.use('/api/users', userRoutes); // User management + public users",
    "app.use('/api/remarks', remarksRoutes);",
    "app.use('/api/locations', locationsRoutes);",
    ""
];

const newContent = [...before, ...newLines, ...after].join('\n');
fs.writeFileSync(serverFile, newContent);
console.log("Refactoring complete");
