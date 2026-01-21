import { GoogleGenAI } from "@google/genai";
import { Message, SenderType, RAGDocument } from '../types';

// Helper for Env Vars
const getEnv = (keys: string[]) => {
  for (const key of keys) {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  }
  return '';
};

const API_KEY = getEnv(['VITE_GEMINI_API_KEY', 'NEXT_PUBLIC_GEMINI_API_KEY', 'REACT_APP_GEMINI_API_KEY']);

let ai: GoogleGenAI | null = null;

try {
  if (API_KEY) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } else {
    console.warn("⚠️ Gemini API Key is missing. AI features will not work.");
  }
} catch (error) {
  console.error("Failed to initialize Gemini client", error);
}

/**
 * Generates a vector embedding for a given text string using Gemini.
 * Model: text-embedding-004
 */
export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  if (!ai) return null;
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      content: text,
    });
    return response.embedding.values || null;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
};

/**
 * Generates a draft response for the agent based on history and RAG context.
 */
export const generateAgentDraft = async (
  history: Message[],
  contextDocs: RAGDocument[],
  userInstruction: string
): Promise<string> => {
  if (!ai) {
    return "Error: Gemini API Key not configured.";
  }

  // Format history (last 10 messages to save tokens)
  const recentHistory = history.slice(-10);
  const conversationText = recentHistory.map(m => 
    `${m.sender === SenderType.USER ? 'Customer' : 'Agent/Bot'}: ${m.text}`
  ).join('\n');

  // Format RAG context
  const contextText = contextDocs.map(d => 
    `Source (${d.title}): ${d.content}`
  ).join('\n\n');

  const prompt = `
    You are a professional customer support assistant for a business.
    
    STRICT RULES:
    1. Use ONLY the provided CONTEXT INFORMATION to answer.
    2. If the answer is NOT in the context, or if the context is empty/irrelevant, return exactly the string: "NO_ANSWER".
    3. Do NOT make up information. Do NOT hallucinate.
    4. Be polite and concise.

    CONTEXT INFORMATION (Knowledge Base):
    ${contextText || "No context available."}

    CONVERSATION HISTORY:
    ${conversationText}

    USER INSTRUCTION:
    ${userInstruction || "Answer the customer based on context."}
    
    OUTPUT:
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Updated to latest recommended model for text tasks
      contents: prompt,
    });
    
    const text = response.text?.trim() || "NO_ANSWER";
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with AI service.";
  }
};