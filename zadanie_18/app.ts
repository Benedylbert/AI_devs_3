import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { OpenAIService } from './OpenAIService';
const { htmlToText } = require('html-to-text')
import { json } from 'express';



interface Message {
    role: string;
    content: string;
}

interface Answer {
    get_url?: string;
    answer?: Record<string, string>;
}

const service = new OpenAIService();

async function getUrl(url: string): Promise<string> {
    const response = await axios.get(url);

    // const options = {
    //   wordwrap: 130,
    //   // ...
    // };
    // const compiledConvert = compile(options); // options passed here
    
    // const htmls = [
    //   '<div>Hello World!</div>',
    //   '<div>こんにちは世界！</div>',
    //   '<div>Привіт Світ!</div>'
    // ];
    // const texts = htmls.map(compiledConvert);



    return htmlToText(response.data)
        .replace('](/', '](https://softo.ag3nts.org/)');
}

async function main() {
    const urlPytania = "https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/softo.json";
    const url = 'https://softo.ag3nts.org/';
    
    const pytaniaResponse = await axios.get(urlPytania);
    const pytania = pytaniaResponse.data;
    
    let pyt = "";
    for (const [klucz, pytanie] of Object.entries(pytania)) {
        pyt += `- ${klucz}: ${pytanie}\n`;
    }
    console.log(pyt);

    const systemPrompt = `Jesteś internetowym detektywem, który odpowiada na pytania dotyczące podanej strony internetowej.
    **pytania (w json):**
    ${JSON.stringify(pytania)}
    **koniec pytań**

    Analizujesz strone internetową uzywając interfejsu: 
    get_url
    *Przykład:*odpowiadasz w jsonie podając za klucz get_url a za wartość wymagany adres. czyli np {'get_url':'https://adres z promptu'}

    **Instrukcja działania:**
    - uzytkownik w pierwszej wiadomości podaje ci adres strony
    - odpytujesz o ten adres interfejs get_url- otrzymujesz treść wraz z linkami przeksztalłconą na markdown
    - analizujesz treść, czy zawiera odpowiedź na któreś z pytań, jeśli tak zapamiętujesz je.
    - jesli zostały jeszcez pytania bez odpowiedzi odpytujesz o kolejne linki na stronie www i szukasz odpowiedzi na podstronach. Dokładnie analizuj link, czy może on zawierać informacje.
    - Nie wchodź na adresy które wyglądają podejrzanie i nie mają nic współnego z pytaniami.
    ** koniec instrukcji**

    Twoje działanie kończy się, gdy znajdziesz odpowiedzi na wszystkie pytania i zwrócisz tą odpowiedź w postaci jsona opisanego poniżejGdy zbierzesz
     odpowiedzi na wszystkie pytania zwróć json o kluczu answer a wartości<|pad|>ką będzie lista słowników w postaci klucz to numer pytania i wartość to odpowiedź.
     Musisz znaleść odpowiedź na wszystkie pytanie, odpytuj nie tylko o adresy widoczne w nagłówku ale i takie w treści (chyba, że ich nazwy sa podejrzane) 
     Nie zwracasz innych odpowiedzi, tylko json z kluczem answer i wartośćą lub kluczem get_url i adresem w wartości.Będziesz otrzymywał treść pobranej storny w toku rozmowy od usera.
     Na końcu zwróć odpowiedź na wszystkie pytania w formie {'anser': {'01': 'odp1','02': 'odp2', itd}}Nie odpowiadaj zanim nie znajdziesz odpowiedzi na wszystkie pytania. 
     Po otrzymasz odpowiedzi na wszystkie pytania zwróć odowiedni json.
    `;

    const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: url }
    ];

    while (true) {
        const answer = await service.completion(messages);
        console.log(answer.choices[0].message.content);
        let answerContent;
        try {
            // First try to parse the content directly
            answerContent = JSON.parse(answer.choices[0].message.content);
        } catch (e) {
            // If direct parsing fails, try to handle single quotes
            const fixedJson = answer.choices[0].message.content
                .replace(/'/g, '"')  // Replace single quotes with double quotes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .replace(/```json\n?/g, '')
                .replace(/```/g, '')
                .trim();
                console.log(fixedJson);
            answerContent = JSON.parse(fixedJson);
        }

        try {
            console.log(answerContent);
            const answerJson = answerContent as Answer;

            if ('get_url' in answerJson) {
                console.log('asystent get_url:', answerJson.get_url);
                const website = await getUrl(answerJson.get_url!);
                messages.push({ role: "user", content: website });
            } else if ('answer' in answerJson) {
                console.log('asystent answer:', answerJson.answer);
                sendRequestCentrala(answerJson.answer);
                break;
            } else {
                console.log('asystent else:', answerContent);
                break;
            }
        } catch (error) {
            console.error('Błąd dekodowania odpowiedzi jako JSON:', answerContent);
            break;
        }
    }
    
}


async function sendRequestCentrala(answerJson: Answer) {

  const finalRequestCentrala = {
    "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
    "task": "softo",
    "answer": answerJson
  }

  try {
    const finalrequest = await axios.post('https://centrala.ag3nts.org/report ', finalRequestCentrala, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

     console.log('Response:', finalrequest.data);
  } catch (error) {
    console.log('Error sending final verification request, will run again');
    console.log(error.response?.data);
    console.log(answerJson);
    console.log(finalRequestCentrala);
  }
}



main().catch(console.error);