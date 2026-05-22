const { GoogleGenAI } = require("@google/genai");
require("dotenv").config({ path: ".env.local" });

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  vertexai: false,
});

async function run() {
  try {
    const models = await genAI.models.list();
    for await (const m of models) {
      console.log(m.name);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
