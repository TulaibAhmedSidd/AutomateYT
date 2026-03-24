import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

export async function generateTopicAndScript(settings: any, customTopic?: string) {
  // If the user provides a custom script, SKIP OpenAI entirely!
  if (customTopic) {
    console.log('Custom script provided, skipping OpenAI and manually parsing...');
    const lines = customTopic.split('\n').filter(l => l.includes('Line:'));
      
    let scenes = [];
    if (lines.length > 0) {
        scenes = lines.map(l => {
            const text = l.replace(/Line:\s*[“"']?/, '').replace(/[”"']?$/, '').trim();
            return { text, imagePrompt: `A captivating historical scene about: ${text}` };
        });
    } else {
        // generic fallback chunking
        const chunks = customTopic.split('\n\n').filter(x => x.length > 5);
        scenes = chunks.map(chunk => ({ text: chunk.substring(0, 200), imagePrompt: chunk.substring(0, 100) }));
    }

    return {
        title: "Custom Generated Video",
        description: "Video generated from custom script",
        tags: ["history", "shorts"],
        scenes: scenes.length > 0 ? scenes : [{ text: customTopic.slice(0, 100), imagePrompt: "Historical background" }]
    };
  }

  // Otherwise, run OpenAI locally to generate a totally random one
  const openai = new OpenAI({
    apiKey: settings.apiKeys.openai || process.env.OPENAI_API_KEY
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Cheaper / free tier model
    messages: [
      {
        role: 'system',
        content: `You are a micro-history YouTube Short scriptwriter. Return a JSON object with:
- title: string
- description: string
- tags: string[]
- scenes: array of objects { text: string, imagePrompt: string }
Keep the video around 60 seconds (approx 150 words total across scenes). Image prompts must be highly descriptive for an AI image generator.`
      },
      {
        role: 'user',
        content: 'Generate a script about a fascinating but lesser-known historical event.'
      }
    ],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

export async function generateVoiceover(text: string, outputPath: string, settings: any) {
  const apiKey = settings.apiKeys.elevenlabs || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ElevenLabs API Key missing');

  // Using dynamic fallback voice
  const VOICE_ID = 'CwhRBWXzGAHq8TQ4Fs17'; // Safe default for all ElevenLabs tiers
  
  const response = await axios({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    data: {
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    },
    responseType: 'arraybuffer'
  });

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, response.data);
}

export async function generateImage(prompt: string, outputPath: string, settings: any) {
  const apiKey = settings.apiKeys.leonardo || process.env.LEONARDO_API_KEY;
  if (!apiKey) throw new Error('Leonardo API Key missing');

  // Generate image using Leonardo.ai API
  const generateRes = await axios.post(
    'https://cloud.leonardo.ai/api/rest/v1/generations',
    {
      prompt: prompt,
      modelId: '6faf9722-29ac-45dd-9a74-d4bb986a7ffc', // Leonardo Vision XL
      width: 1080,
      height: 1920,
      num_images: 1
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  const generationId = generateRes.data.sdGenerationJob.generationId;

  // Poll for completion
  let imageUrl = null;
  while (!imageUrl) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await axios.get(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (statusRes.data.generations_by_pk.status === 'COMPLETE') {
      imageUrl = statusRes.data.generations_by_pk.generated_images[0].url;
    } else if (statusRes.data.generations_by_pk.status === 'FAILED') {
      throw new Error('Image generation failed');
    }
  }

  // Download image
  const imgResponse = await axios({
    method: 'GET',
    url: imageUrl,
    responseType: 'arraybuffer'
  });

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, imgResponse.data);
}
