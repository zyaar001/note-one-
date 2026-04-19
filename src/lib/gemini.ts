import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function explainNote(title: string, notes: string, fileData?: { base64: string, mimeType: string }): Promise<string> {
  const prompt = `You are a friendly and expert tutor. Your goal is to help a student fully understand the following topic/notes.
Be pedagogically effective. Break down complex topics into simpler pieces, use analogies if helpful, and keep a conversational and encouraging tone.

Topic / Title: ${title}
Notes / Input:
${notes || "(See attached document for context)"}

Generate a comprehensive, easy-to-understand explanation using markdown formatting (e.g. bolding, lists, headings where appropriate).`;

  try {
    const contents: any = [{
      role: 'user',
      parts: [
        { text: prompt }
      ]
    }];

    if (fileData) {
      contents[0].parts.push({
        inlineData: {
          data: fileData.base64,
          mimeType: fileData.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Good for complex reasoning and pedagogy
      contents: contents,
      config: {
        systemInstruction: "You are an expert tutor. Use markdown. Be clear, encouraging, and break down complex concepts.",
      }
    });
    
    return response.text || "No explanation could be generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}


export async function chatAboutNote(title: string, notes: string, explanation: string, history: {role: string, text: string}[], message: string): Promise<string> {
  const systemInstruction = `You are a multilingual AI tutor (akin to Grok, but helpful, educational, and slightly witty). 
You assist the user with follow-up questions specifically about their recently generated note. 
You understand and can converse fluently in English, Hindi, and Urdu. Fluidly mix them or adapt based on how the user speaks to you.

Context of the current topic:
Title: ${title}
Original Notes Synopsis: ${notes.substring(0, 800)}...
Your previous explanation synopsis: ${explanation.substring(0, 800)}...`;

  const contents: any[] = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: { systemInstruction }
    });
    
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
}

export async function generateEnhancedVoiceExplainer(title: string, notes: string, fileData?: { base64: string, mimeType: string }): Promise<string> {
  const promptText = `You are an enhanced voice explainer. Explain the following topic naturally, as if you are a friendly human tutor chatting with a student.
Crucially, avoid robotic or overly computerized tones. Explain complex topics in simple, relatable language, and relate concepts to everyday life for better understanding.
Make it sound like a natural podcast host or a smart friend speaking directly to the listener. Make your explanation around 1-2 minutes when spoken.

Topic: ${title}
Original Notes Context: ${notes.substring(0, 1000)}... ${fileData ? '(A file was also attached)' : ''}

Respond purely with the spoken conversational text.`;

  try {
    const contents: any[] = [{
      role: 'user',
      parts: [{ text: promptText }]
    }];

    if (fileData) {
      contents[0].parts.push({
        inlineData: { data: fileData.base64, mimeType: fileData.mimeType }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: contents,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }, // Puck has a dynamic, youthful, natural tone
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio returned from model.");
    return base64Audio;
  } catch (error) {
    console.error("Gemini Enhanced TTS Error:", error);
    throw error;
  }
}

export async function generateAudioExplanation(title: string, notes: string, preference: string): Promise<string> {
  const prompt = `You are an AI learning assistant akin to 'Grok AI'—witty, slightly rebellious, highly conversational, and adaptable.
Explain the following topic to the user. Keep your explanation relatively short and engaging (under 1-2 minutes spoken).
Crucially, you MUST use the following language/slang preference: ${preference || 'A mix of English, Hindi, and Urdu slang'}.
Make sure to mix the languages fluidly to fit the persona.

Topic: ${title}
Original Notes Context: ${notes.substring(0, 800)}... (abbreviated)

Provide your entire response as spoken word text that will be synthesized into speech.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: prompt,
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
    if (!base64Audio) throw new Error("No audio returned from model.");
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}
