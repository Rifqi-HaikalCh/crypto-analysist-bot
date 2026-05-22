const { GoogleGenAI } = require("@google/genai");
console.log("Keys:", Object.keys(require("@google/genai")));
try {
  const genAI = new GoogleGenAI({ apiKey: "test", vertexai: false });
  console.log("genAI initialized");
} catch (e) {
  console.error("Error initializing:", e.message);
}
