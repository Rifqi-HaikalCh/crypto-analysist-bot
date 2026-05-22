const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  vertexai: false,
});

async function run() {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "hello",
      config: { temperature: 0.3, maxOutputTokens: 1024 },
    });
    console.log("Success:", response.text);
  } catch (e) {
    console.error("Generate content error:", e);
  }
}

run();
