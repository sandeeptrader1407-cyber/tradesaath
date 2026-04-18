const fs = require('fs');
const path = require('path');

async function test() {
  // Read the test PDF
  const filePath = path.join(__dirname, 'test-trade.pdf');
  if (!fs.existsSync(filePath)) {
    console.log("No test-trade.pdf found. Put a PDF in the project root and try again.");
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');

  console.log("File size:", fileBuffer.length, "bytes");
  console.log("Base64 length:", base64.length);
  console.log("API key exists:", !!process.env.ANTHROPIC_API_KEY);
  console.log("API key starts with:", process.env.ANTHROPIC_API_KEY?.substring(0, 10));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          {
            type: 'text',
            text: 'List the first 5 trades from this document. Just the symbol, buy/sell, quantity, and price. Keep it short.'
          }
        ]
      }]
    })
  });

  console.log("Response status:", response.status);
  const data = await response.json();

  if (data.error) {
    console.error("API ERROR:", JSON.stringify(data.error, null, 2));
  } else {
    console.log("SUCCESS! Response:");
    console.log(data.content[0].text);
  }
}

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}
test().catch(e => console.error("CRASH:", e.message));
