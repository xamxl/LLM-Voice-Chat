import appConfig from "./app-config";
import * as webllm from "@mlc-ai/web-llm";

let config: webllm.AppConfig = appConfig;
const useWebWorker = appConfig.use_web_worker;
let engine: webllm.MLCEngineInterface;
let selectedModel = config.model_list[0].model_id;
let chatRequestChain: Promise<void> = Promise.resolve();
let requestInProgress = false;
let chatLoaded = false;
let chatHistory: webllm.ChatCompletionMessageParam[] = [];
const outputDiv = document.getElementsByName('speakingText')[0];
let utterThis;

let generating = false;
let toRead = "";

// FIX THIS BY MAKING IT ADD TO A THING THAT YOU SUBTRACT FROM SO YOU DO NOT MISS ANYTHING
// function getLastSentence(text) {
//     // Match sentences ending with . ! ? : or any quotes (single or double)
//     let sentences = text.match(/[^.!?¡\(\)]+[.!?¡¿\(\)]*/g);
//     if (sentences && sentences.length > 0) {
//         return sentences[sentences.length - 1].trim();
//     } else {
//         return "";
//     }
// }

function extractFirstSentence(text) {
    const sentenceEndings = /[.!?]/;
    const match = text.match(sentenceEndings);

    if (!match) {
        return "";
    }

    const firstSentence = text.slice(0, match.index + 1).trim();
    const remainingText = text.slice(match.index + 1).trim();

    //if (/[A-Z]/.test(firstSentence[0]) && firstSentence.length > 1) {
    if (firstSentence.length > 1) {
        return {
            firstSentence: firstSentence,
            remainingText: remainingText
        };
    }

    return "";
}

if (useWebWorker) {
    engine = new webllm.WebWorkerMLCEngine(new Worker(
        new URL('./worker.ts', import.meta.url),
        { type: 'module' }
    ));
} else {
    engine = new webllm.MLCEngine();
}

 /**
   * Push a task to the execution queue.
   *
   * @param task The task to be executed;
   */
function pushTask(task: () => Promise<void>) {
    const lastEvent = chatRequestChain;
    chatRequestChain = lastEvent.then(task);
}

// Event handlers
  // all event handler pushes the tasks to a queue
  // that get executed sequentially
  // the tasks previous tasks, which causes them to early stop
  // can be interrupted by engine.interruptGenerate
async function onGenerate(input) {
    if (requestInProgress) {
        return;
    }
    pushTask(async () => {
        await asyncGenerate(input);
    });
}

function setLabel(id: string, text: string) {
    const label = document.getElementById(id);
    if (label == null) {
      throw Error("Cannot find label " + id);
    }
    label.innerText = text;
}

async function asyncInitChat() {
    if (chatLoaded) return;
    requestInProgress = true;
    const initProgressCallback = (report) => {
        setLabel("init-label", report.text);
    }
    engine.setInitProgressCallback(initProgressCallback);

    try {
      await engine.reload(selectedModel, undefined, config);
    } catch (err) {
      return;
    }
    requestInProgress = false;
    chatLoaded = true;
    startButton.disabled = false;
    document.getElementsByClassName("loader")[0].style.backgroundColor = "rgb(130, 202, 53)";
}

async function asyncGenerate(input) {
    generating = true;
    toRead = "";
    await asyncInitChat();
    requestInProgress = true;
    const prompt = input;

    chatHistory.push({ "role": "user", "content": prompt });

    try {
      let curMessage = "";
      const completion = await engine.chat.completions.create({ stream: true, messages: chatHistory });
      // TODO(Charlie): Processing of � requires changes
      for await (const chunk of completion) {
        const curDelta = chunk.choices[0].delta.content;
        if (curDelta) {
          curMessage += curDelta;
          toRead += curDelta;
        }
        outputDiv.textContent = curMessage;

        if (extractFirstSentence(toRead) != "") {
            let toPrint = extractFirstSentence(toRead).firstSentence;
            toRead = extractFirstSentence(toRead).remainingText;
            utterThis = new SpeechSynthesisUtterance(toPrint);
            let voiceToUse;
            
            if (language == 'es') {
                voiceToUse = 'Google español';
            } else if (language == 'fr') {
                voiceToUse = 'Google français';
            } else if (language == 'de') {
                voiceToUse = 'Google Deutsch';
            } else if (language == "nl") {
                voiceToUse = 'Google Nederlands';
            } else {
                voiceToUse = 'Google US English';
            }
            
            for (const voice of synth.getVoices()) {
                if (voice.name === voiceToUse) {
                utterThis.voice = voice;
                break;
                }
            }
            
            synth.speak(utterThis);
        }

        // check if a sentence was just completed. If it was, get the whole sentence
        /*const lastSentence = getLastSentence(curMessage);
        if (curDelta != "" && curDelta != undefined && (curMessage.endsWith('.') || curMessage.endsWith('!') || curMessage.endsWith('?'))) {
            console.log("new utter");
            utterThis = new SpeechSynthesisUtterance(lastSentence);
            let voiceToUse;
            
            if (language == 'es') {
                voiceToUse = 'Google español';
            } else if (language == 'fr') {
                voiceToUse = 'Google français';
            } else {
                voiceToUse = 'Google US English';
            }
            
            for (const voice of synth.getVoices()) {
                if (voice.name === voiceToUse) {
                utterThis.voice = voice;
                break;
                }
            }
            
            synth.speak(utterThis);
        }*/


        if (generating && (curDelta == "" || curDelta == undefined)) {
            console.log("set stop");
            generating = false;
            utterThis.addEventListener('end', () => {
                console.log("stop");
                startButton.textContent = 'Listening (Stop speaking to send)';
                recognition.stop();
                recognition.start();
            });
        }
      }
      const finalMessage = await engine.getMessage();
      outputDiv.textContent = finalMessage;
      chatHistory.push({ "role": "assistant", "content": finalMessage });
    } catch (err) {}
    requestInProgress = false;
}

function getLanguageFromCurrentUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const language = urlParams.get('lan');
    return language ? language : 'en';
}

const language = getLanguageFromCurrentUrl();

let starts = {"en": "This conversation should be in english. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "es": "This conversation should be in spanish. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "fr": "This conversation should be in french. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "de": "This conversation should be in german. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "nl": "This conversation should be in dutch. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day."};

chatHistory.push({ "role": "assistant", "content": starts[language] });
const synth = window.speechSynthesis;

// Update the "change language" text based on the language
const changeLanguageText = document.getElementsByName('lanText')[0];
changeLanguageText.innerHTML = `Change Language (${language || 'en'})`;

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
stopButton.style.display = "none";

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
recognition.lang = language + '-US';

stopButton.addEventListener('click', () => {
    cancel = true;
    recognition.stop();
    startButton.textContent = 'Record';
    startButton.disabled = false;
    stopButton.style.display = "none";

    speechSynthesis.cancel();
});

recognition.onstart = () => {
    cancel = false;
    startButton.textContent = 'Listening (Stop speaking to send)';
    startButton.disabled = false;
    stopButton.style.display = "block";
};

recognition.onresult = (event) => {
    if (cancel) {
        cancel = false;
        return;
    }

    const transcript = event.results[0][0].transcript;
    outputDiv.textContent = transcript;
    startButton.textContent = 'Loading response ...';

    onGenerate(transcript);
};

recognition.onend = () => {};

startButton.addEventListener('click', () => {
    recognition.start();
});

asyncInitChat();