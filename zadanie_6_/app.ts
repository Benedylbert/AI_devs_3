import { OpenAIService } from './OpenAIService';
import fs from 'fs/promises'; // Add this import at the top
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type OpenAI from 'openai';
import path from 'path';
import axios from 'axios';


const openaiService = new OpenAIService();


async function sendVerificationRequest(): Promise<void> {

  try {
    const rafal = await fs.readFile(path.join(__dirname, '/przesłuchania/rafal.m4a'));
    const adam = await fs.readFile(path.join(__dirname, '/przesłuchania/adam.m4a'));
    const agnieszka = await fs.readFile(path.join(__dirname, '/przesłuchania/agnieszka.m4a'));
    const ardian = await fs.readFile(path.join(__dirname, '/przesłuchania/ardian.m4a'));
    const michal = await fs.readFile(path.join(__dirname, '/przesłuchania/michal.m4a'));
    const monika = await fs.readFile(path.join(__dirname, '/przesłuchania/monika.m4a'));
    let street;

        try {
            // Pass the file buffer to the transcription service
            const transcriptionRafal = await readFromFileOrAddFile(rafal,'rafal.txt')
            const transcriptionAdam = await readFromFileOrAddFile(adam,'adam.txt')
            const transcriptionAgnieszka = await readFromFileOrAddFile(agnieszka,'agnieszka.txt')
            const transcriptionArdian = await readFromFileOrAddFile(ardian,'ardian.txt')
            const transcriptionMichal = await readFromFileOrAddFile(michal,'michal.txt')
            const transcriptionMonika = await readFromFileOrAddFile(monika,'monika.txt')

            const prompt = createSystemPrompt(transcriptionRafal, transcriptionAdam, transcriptionAgnieszka, transcriptionArdian, transcriptionMichal, transcriptionMonika)


            //await fs.writeFile('./prompt.txt', JSON.stringify(prompt));


            const config = {
              messages: [prompt],
              model: "gpt-4o"
            }

            
            const reponse = await openaiService.completion(config) as OpenAI.Chat.Completions.ChatCompletion;
          
            street = reponse.choices[0].message.content;
          
            
            
        } catch (error) {
            console.error('Transcription error:', error);
        }


          const finalResponse = {
            apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
            task: 'mp3',
            answer: street
          }

          console.log(finalResponse);
 
      
        const finalrequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
    
         console.log('Response:', finalrequest.data);
      } catch (error) {
        console.log('Error sending final verification request, will run again');
      //console.log(error);
      
    
      }
}

function createSystemPrompt(rafal: string,adam: string,agnieszka: string,ardian: string,michal: string,monika: string): ChatCompletionMessageParam {
    return {
      role: "system",
      content: `
        <objectives>
        In <interrogations> section you have informations about people who were interrogated. They are talk about Andrzej Maj and what university he works at.
        Your task is to deducate what university is it and on which street is it located.
        This university is located in Poland. Informations can include the description of this university so you need to check for example on which street is located this university.
        <objectives>
        <interrogations>
        rafal:
        ${rafal}

        adam:
        ${adam}

        agnieszka:
        ${agnieszka}

        ardian:
        ${ardian}

        michal:
        ${michal}

        monika:
        ${monika}

        </interrogations>

        <big_thinking>
          Before the answer, think for a while about informations from <interrogations> section. The most important person which have the most valuable informations are from rafal.
          He is describing the university , please find this university based on the description then check on which street is it located, informations from other people can be helpful.
        <big_thinking>

        As answer return only the name of this street.
        `
    }
  };

// Execute the function
sendVerificationRequest();


async function readFromFileOrAddFile(audioBuffer: Buffer, name: string): Promise<string> {
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