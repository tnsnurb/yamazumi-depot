const express = require('express');
const app = express();
const PORT = 3002;

app.get('/ping', (req, res) => {
    console.log('Got ping!');
    res.send('pong');
});

app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});
