import { OpenAIService } from './OpenAIService';
import fs from 'fs/promises'; // Add this import at the top
import { readdirSync, statSync } from 'fs'; // Add this import
import type { ChatCompletion, ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type OpenAI from 'openai';
import path from 'path';
import axios from 'axios';
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
const OPTIMIZED_IMAGE_PATH = join(__dirname, 'lessons_optimized.png');
const COMPRESSION_LEVEL = 5;
const IMAGE_DETAIL: 'low' | 'high' = 'high';
import type { ResizedImageMetadata } from "./app.dt.ts";

const people: string[] = [];
const hardware: string[] = [];
const openaiService = new OpenAIService();


function createSystemPromptAudio(text: string): ChatCompletionMessageParam {
    return {
      role: "system",
      content: `
         In <informations> section you have description which can include:
         - technical reports, 
         - security, 
         - traces of intruders 
         - captured people 
         - repaired hardware faults.

        <objectives>
          Deducate based on included informations decide about which topic is about. Focus mostly on captured people, intruders and traces of intruders and repaired hardware faults.

          Reuturn 'people' if description is about captured people or intruders from factory or 'hardware' if description is about repaired hardware faults, for other topics return 'other'.
        <objectives>
        
        <informations>
          ${text}
        </informations>

        <big_thinking>
          Before the answer, think about informations from <informations> section and then decide about which topic is about. In informations include informations about peoples and food, return 'other'.
        <big_thinking>

        As answer return ONLY 'people' or 'hardware' or 'other'. Example: 'people'.
        `
    }
  };


async function readFromFileOrAddFileAudio(audioBuffer: Buffer, name: string): Promise<string> {
  let transcription
  try {
    // Try to read from cache file
    transcription = await fs.readFile(name, 'utf-8');
  } catch {
      // If file doesn't exist, transcribe and save to cache
      transcription = await openaiService.transcribeGroq(audioBuffer);
      await fs.writeFile('./' + name, transcription);
  }

  return transcription;
}

async function readFromFileOrAddFileImage(filePath: string, name: string): Promise<string> {
  let imageText
  try {
    // Try to read from cache file
    console.log('readFromFileOrAddFileImage fileExists: ' + name);
    imageText = await fs.readFile(name, 'utf-8');
  } catch {
    console.log('readFromFileOrAddFileImage fileNotExists: ' + name);
      const imageText = await transcribePhoto(filePath);
      await fs.writeFile('./' + name, imageText);
  }

  return imageText ?? '';
}

async function processImage(imageUrl: string): Promise<{ imageBase64: string; metadata: ResizedImageMetadata }> {
  try {
      const imageBuffer = readFileSync(imageUrl);
      const resizedImageBuffer = await sharp(imageBuffer)
          .resize(2048, 2048, { fit: 'inside' })
          .png({ compressionLevel: COMPRESSION_LEVEL })
          .toBuffer();

      await sharp(resizedImageBuffer).toFile(OPTIMIZED_IMAGE_PATH);

      const imageBase64 = resizedImageBuffer.toString('base64');
      const metadata = await sharp(resizedImageBuffer).metadata();

      if (!metadata.width || !metadata.height) {
          throw new Error("Unable to retrieve image dimensions.");
      }

      return { imageBase64, metadata: { width: metadata.width, height: metadata.height } };
  } catch (error) {
      console.error("Image processing failed:", error);
      throw error;
  }
}

async function checkResponseAndAddToArrays(text: string, fileName: string) {
  const config = {
    messages: [] as ChatCompletionMessageParam[],
    model: "gpt-4o"
  }
  

  config.messages = [createSystemPromptAudio(text)];
  const reponse = await openaiService.completion(config) as OpenAI.Chat.Completions.ChatCompletion;
  const responseText = reponse.choices[0].message.content;
  console.log('finename: ' + fileName);
  console.log('responseText: ' + responseText);

  if (responseText?.includes('people')) {
    people.push(fileName);
  } else if (responseText?.includes('hardware')) {
    hardware.push(fileName);
  }
}

async function checkFiles() {
  const folderPath = path.join(__dirname, 'pliki_z_fabryki');

  try {
    const files = readdirSync(folderPath);
    
    // Use Promise.all to wait for all file processing to complete
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      const stats = statSync(filePath);
      
      if (stats.isFile()) {
        const extension = filePath.split('.').pop()   ;
        const fileName = filePath.split('\\').pop() || '';
        
        if (extension === 'txt') {
          const textFile = await fs.readFile(filePath, 'utf-8');
          await checkResponseAndAddToArrays(textFile, fileName);
        }

        if (extension === 'mp3') {
          const audioFile = await fs.readFile(filePath);
          const transcription = await readFromFileOrAddFileAudio(audioFile, fileName?.replace('.mp3','') + '.txt');
          await checkResponseAndAddToArrays(transcription, fileName);
        }

        if (extension === 'png') {
          //console.log('readFromFileOrAddFileImage extension: ' + extension);
          //const imageText = await transcribePhoto(filePath);
          const imageText = await readFromFileOrAddFileImage(filePath, fileName?.replace('.png','') + '.txt');
          await checkResponseAndAddToArrays(imageText.toLocaleLowerCase().replaceAll('repair note', ''), fileName);
          
        }
      }
    }));


  } catch (error) {
    console.error('Error reading directory:', error);
  }
}


async function sendRequestToCentrala() {
  await checkFiles();

  const finalResponse = {
    apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
    task: 'kategorie',
    answer: {
      people: people.sort(),
      hardware: hardware.sort()
    }
  }

  try {
    const finalrequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Response:', finalrequest.data);
  } catch (error) {
    console.error('Error sending request to centrala:');
    console.log(error);
  }

  console.log(finalResponse);
  
}

async function transcribePhoto(filePath: string) {

  const photo_data = await processImage(filePath);
  
  const messages: ChatCompletionMessageParam[] = [
    {
        role: "system",
        content: "You have perfect vision and you can read text from image."
    },
    {
        role: "user",
        content: [
            {
                type: "image_url",
                image_url: {
                    url: `data:image/jpeg;base64,${photo_data.imageBase64}`,
                    detail: "high"
                }
            },
            {
                type: "text",
                text: `On four the image is report with description. Read this text and return only text from image.
                
                <objectives>
                Recognize text on the image and return only this text. Exactly as it is on the image.
                </objectives>

                Return only text from image.
               
                `
            },
        ]
    }
];
const chatCompletion = await openaiService.completionImage(messages, "gpt-4o", false, false, 1024) as ChatCompletion;

return chatCompletion.choices[0].message.content ?? '';
}

sendRequestToCentrala();
