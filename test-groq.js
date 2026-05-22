const { Groq } = require("groq-sdk");
require("dotenv").config({ path: ".env.local" });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Test" }],
      model: "llama-3.3-70b-versatile",
    });
    console.log(chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error("Groq Error:", error.message);
  }
}

main();
