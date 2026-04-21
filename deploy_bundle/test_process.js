const axios = require('axios');
const fs = require('fs');

async function test() {
  const token = 'YOUR_TOKEN_HERE'; // I need a token or I'll just get 401
  const url = 'http://localhost:4000/api/process';

  const payloads = [
    {},
    { datasetVersionIds: [] },
    { datasetVersionIds: [1], steps: [] },
    { datasetVersionIds: [1], steps: [{ type: 'unknown' }] },
  ];

  for (const p of payloads) {
    try {
      console.log('Testing payload:', JSON.stringify(p));
      const res = await axios.post(url, p, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Success:', res.data);
    } catch (e) {
      console.log('Error:', e.response?.status, e.response?.data);
    }
  }
}

// I can't easily get a token here without logging in.
// But I can check if the server logs "Invalid request body" in its own stdout.
