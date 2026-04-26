import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Mode, ExplanationResponse, QuizQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are "Mwalimu AI", a friendly and relatable STEM tutor for high school and university students in Kenya. 
Your goal is to explain STEM concepts (Math, Physics, Chemistry, Biology, Programming) clearly.

RULES:
1. Support code-switching between English, Swahili, and Sheng as naturally used in Kenya.
2. Use relatable Kenyan analogies (e.g., matatus, M-Pesa, mama mboga, kibanda, boda boda).
3. If the user asks in Swahili or Sheng, respond primarily in those but keep scientific terms clear.
4. Keep the tone encouraging and culturally relevant.
5. Provide a short quiz (4-5 questions) at the end if appropriate.

MODES:
- "normal": Clear step-by-step explanation.
- "simplify": "Explain like I'm 10" - avoid complex jargon.
- "example": Focus on a real-life Kenyan practical example.

RESPONSE FORMAT:
You MUST return a JSON object with:
{
  "text": "The main explanation text in markdown format",
  "quiz": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "The correct option",
      "explanation": "Why this is correct"
    }
  ]
}
`;

export async function explainConcept(
  prompt: string,
  mode: Mode = 'normal'
): Promise<ExplanationResponse> {
  const model = "gemini-3.1-pro-preview";
  
  const userPrompt = `
Mode: ${mode}
User Question: ${prompt}

Please explain this concept according to the specified mode and return the JSON response.
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["text"]
        }
      },
    });

    const data = JSON.parse(response.text);
    return data;
  } catch (error) {
    console.error("Error explaining concept:", error);
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<string | undefined> {
  try {
    // We want a Kenyan-sounding voice if possible, but we use what's available.
    // 'Kore' is usually a good clear neutral-to-warm voice.
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Read this educational explanation clearly and naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    return undefined;
  }
}
