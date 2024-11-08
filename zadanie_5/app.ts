import axios from 'axios';

async function sendVerificationRequest(): Promise<void> {

  try {
    

    const responseCentrala = await axios.get('https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/cenzura.txt', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const cenzura = responseCentrala.data
      const finalResponse = {
        apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
        task: 'CENZURA',
        answer: ''
      }

      const systemPrompt = createSystemPrompt(cenzura);
      const llamaBody = {
        prompt: systemPrompt,
        stream: false,
        format: "json",
        system: "repond in this format {'result':'...'}",
        model: "gemma:2b"
      }


      const reponseFromLLama = await axios.post('http://localhost:11434/api/generate', llamaBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(cenzura);

      finalResponse.answer = JSON.parse(reponseFromLLama.data.response).result;
      console.log(finalResponse.answer);

      try {
        const finalrequest = await axios.post('https://centrala.ag3nts.org/report ', finalResponse, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
    
         console.log('Response:', finalrequest.data);
      } catch (error) {
        console.log('Error sending final verification request, will run again');
        console.log('Retrying...');
        await sendVerificationRequest();
      }

  } catch (error) {
    console.error('Error sending verification request:', error);
  }
}

function createSystemPrompt(question: string): String {
    return `
    <objectives>
    Task: In the given text from <information> section, replace only sensitive information such as name, surname, residential address (including city, street, and number), and age with the word "CENZURA". 
    
    Use the following examples for guidance:
    <objectives>
    <examples>
    Example 1:
    - Original: "Tożsamość osoby podejrzanej: Piotr Lewandowski. Zamieszkały w Łodzi przy ul. Wspólnej 22. Ma 34 lata."
    - Result: "Tożsamość osoby podejrzanej: CENZURA. Zamieszkały w CENZURA przy ul. CENZURA. Ma CENZURA lata."

    Example 2:
    - Original: "Dane osoby podejrzanej: Paweł Zieliński. Zamieszkały w Warszawie na ulicy Pięknej 5. Ma 28 lat."
    - Result: "Dane osoby podejrzanej: CENZURA. Zamieszkały w CENZURA na ulicy CENZURA. Ma CENZURA lat."

    Example 3:
    - Original: "Adam Nowak. Mieszka w Katowicach przy ulicy Tuwima 10. Wiek: 32 lata.."
    - Result: "CENZURA. Mieszka w CENZURA przy ulicy CENZURA. Wiek: CENZURA lata."

    Example 4:
    - Original: "Osoba podejrzana to Andrzej Mazur. Adres: Gdańsk, ul. Długa 8. Wiek: 29 lat."
    - Result: "Osoba podejrzana to CENZURA. Adres: CENZURA. Wiek: CENZURA lat."
    </examples>

    Your task is to apply this transformation consistently to provided text inputs.
    Do not replace 'we' with 'w'.
    Do not replace 'lat' with 'lata'.

    <information>
      ${question}
    <information>
    `
  };

// Execute the function
sendVerificationRequest();
