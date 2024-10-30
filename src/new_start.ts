import * as webllm from "@mlc-ai/web-llm";

import { prebuiltAppConfig } from "@mlc-ai/web-llm";
//import { send } from "process";

const appConfig = {
    "model_list": prebuiltAppConfig.model_list,
    "use_web_worker": true
};

const language = getLanguageFromCurrentUrl();
let stopGenerating = false;
//let errorRec;

//START
//const recognition1 = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();;
//recognition1.lang = language + '-US';

// Continuous listening
//recognition1.continuous = true;
//recognition1.interimResults = true;

// Variable to track if user has started speaking
//let userSpeaking = false;

/*recognition1.onstart = () => {
    console.log('Speech recognition started');
    startButton.textContent = 'Listening (Stop speaking to send)';
};

recognition1.onresult = (event) => {
    console.log("INTERUPTED");
    for (let i = event.resultIndex; i < event.results.length; i++) {
        let transcript1 = event.results[i][0].transcript.trim();

        if (transcript1 && !userSpeaking) {
            userStartedSpeaking();
            userSpeaking = true;
        }

        // Reset userSpeaking when final result is obtained
        if (event.results[i].isFinal) {
            userSpeaking = false;

            console.log(event.results);
            let transcript1 = event.results[event.results.length - 1][0].transcript;
            outputDiv.textContent = transcript1;
            startButton.textContent = 'Loading response ...';

            onGenerate(transcript1);
        }
    }
};

recognition1.onend = () => {
    console.log('Speech recognition ended');
    if (errorRec == "no-speech") {
        recognition1.start();
    }
};*/

// Handle errors
/*recognition1.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    errorRec = event.error;
};*/
//STOP

let config: webllm.AppConfig = appConfig;
const useWebWorker = true;
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

let stopped = false;

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
    stopGenerating = false;
    /*try {
        // UNCOMMENT TO CONTINUE DEVELOPMENT OF INTERRUPTING
        //recognition1.start();
    } catch (err) {}*/
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
        let curDelta = chunk.choices[0].delta.content;
        // replace ... in curDelta with .
        try{
            curDelta = curDelta.replace(/(\.\.\.)/g, ".");
        } catch (err) {}
        
        if (curDelta) {
          curMessage += curDelta;
          toRead += curDelta;
        }
        outputDiv.textContent = curMessage;

        if (stopGenerating) {
            stopGenerating = false;
            startButton.textContent = 'Listening (Stop speaking to send)';
            chatHistory.push({ "role": "assistant", "content": curMessage });
            console.log("FINISHED GENERATING");
            chunks.push(curMessage);
            requestInProgress = false;
            generating = false;
            return;
        }

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
            
            console.log(utterThis);
            utterThis.lang = utterThis.voice.lang;
            console.log("speaking!!!");
            synth.speak(utterThis);
            console.log(utterThis);
        }

        if (generating && (curDelta == "" || curDelta == undefined)) {
            generating = false;
            utterThis.addEventListener('end', () => {
                startButton.textContent = 'Listening (Stop speaking to send)';
                recognition.stop();
                console.log("starting recognition fjsldkfs");
                recognition.start();
            });
            utterThis.addEventListener('start', () => {
                console.log("I'M SPEAKING NOW!!!");
            });
        }
      }
      const finalMessage = await engine.getMessage();
      outputDiv.textContent = finalMessage;
      chatHistory.push({ "role": "assistant", "content": finalMessage });
      console.log("PUSHING FINAL MESSAGE");
      chunks.push(finalMessage);
    } catch (err) {
        console.log(err);
    }
    requestInProgress = false;
}

function getLanguageFromCurrentUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const language = urlParams.get('lan');
    return language ? language : 'en';
}

let starts = {"en": "This conversation should be in english. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "es": "This conversation should be in spanish. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "fr": "This conversation should be in french. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "de": "This conversation should be in german. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day.", "nl": "This conversation should be in dutch. All responses should be short. Correct grammar and add new vocabulary. Ask questions about the user's day."};

chatHistory.push({ "role": "assistant", "content": starts[language] });
const synth = window.speechSynthesis;

// Update the "change language" text based on the language
const changeLanguageText = document.getElementsByName('lanText')[0];
changeLanguageText.innerHTML = `Change Language (${language || 'en'})`;

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const downloadButton = document.getElementById('downloadButton');
const sendEmailButton = document.getElementById('sendEmailButton');

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
recognition.lang = language + '-US';

stopButton.addEventListener('click', () => {
    stopped = true;
    cancel = true;
    recognition.stop();
    startButton.textContent = 'Record';
    startButton.disabled = false;
    stopButton.style.display = "none";

    speechSynthesis.cancel();
    stopRecording();
});

recognition.onstart = () => {
    //recognition1.stop();
    cancel = false;
    startButton.textContent = 'Listening (Stop speaking to send)';
    startButton.disabled = false;
    stopButton.style.display = "block";
    downloadButton.style.display = "block";
    sendEmailButton.style.display = "block";
    startRecording();
};

downloadButton.addEventListener('click', () => {
    downloadRecording();
});

sendEmailButton.addEventListener('click', () => {
    const emailPopup = document.createElement('div');
    emailPopup.style.position = 'fixed';
    emailPopup.style.top = '50%';
    emailPopup.style.left = '50%';
    emailPopup.style.transform = 'translate(-50%, -50%)';
    emailPopup.style.backgroundColor = 'white';
    emailPopup.style.padding = '2em';
    emailPopup.style.border = '0.05em solid grey';
    emailPopup.style.borderRadius = '1em';
    emailPopup.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'form-control';
    emailInput.style.marginTop = '0.5em';
    emailInput.style.marginBottom = '1em';
    emailInput.placeholder = 'Email address ...';
    emailPopup.appendChild(emailInput);
  
    const submitButton = document.createElement('button');
    submitButton.innerText = 'Submit';
    submitButton.className = 'btn btn-primary';
    emailPopup.appendChild(submitButton);
  
    const cancelButton = document.createElement('button');
    cancelButton.innerText = 'Cancel';
    cancelButton.className = 'btn btn-secondary';
    cancelButton.style.marginLeft = '1em';
    emailPopup.appendChild(cancelButton);

    // blur out everything else
    const elements = document.querySelectorAll('body > *');
    elements.forEach(element => {
      element.style.filter = 'blur(3px)';
    });

    // disable all buttons
    startButton.disabled = true;
    stopButton.disabled = true;
    downloadButton.disabled = true;
    sendEmailButton.disabled = true;

    document.body.appendChild(emailPopup);
    emailPopup.style.filter = 'none';
  
    submitButton.addEventListener('click', () => {
      const email = emailInput.value;
      if (email) {
        // Handle email submission logic here
        document.body.removeChild(emailPopup);

        // unblur everything
        elements.forEach(element => {
          element.style.filter = 'none';
        });

        startButton.disabled = false;
        stopButton.disabled = false;
        downloadButton.disabled = false;
        sendEmailButton.disabled = false;

        const formattedChunks = chunks.map((chunk, index) => {
            if (index % 2 === 0) {
                // Audio chunk
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result.split(',')[1];
                        resolve({ type: 'audio', data: base64data });
                    };
                    reader.readAsDataURL(chunk);
                });
            } else {
                // Text chunk
                return Promise.resolve({ type: 'text', data: chunk });
            }
        });
    
        Promise.all(formattedChunks).then((finalChunks) => {
            // Add the language at the end
            finalChunks.push({ type: 'language', data: language });
    
            const blob = JSON.stringify(finalChunks);
            
            fetch('http://localhost:5001/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, blob })
            })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Email sent') {
                    alert('Email sent successfully');
                } else {
                    alert('Error sending email');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error sending email');
            });
    
            chunks = []; // Clear chunks after download
        });
      }
    });
  
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(emailPopup);

        // unblur everything
        elements.forEach(element => {
          element.style.filter = 'none';
        });

        startButton.disabled = false;
    stopButton.disabled = false;
    downloadButton.disabled = false;
    sendEmailButton.disabled = false;
    });
  });
  

recognition.onresult = (event) => {
    stopRecording();
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
    if (stopped) {
        chunks = [];
    }
    stopped = false;
    recognition.start();
});

let mediaRecorder;
let chunks = [];

if (navigator.mediaDevices) {

  const constraints = { audio: true };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        console.log("pushing audio");
        chunks.push(e.data);
      };
    })
    .catch((err) => {
      console.error(`The following error occurred: ${err}`);
    });
}

function startRecording() {
  if (mediaRecorder && mediaRecorder.state !== "recording") {
    mediaRecorder.start();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

function downloadRecording() {
    const formattedChunks = chunks.map((chunk, index) => {
        if (index % 2 === 0) {
            // Audio chunk
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    resolve({ type: 'audio', data: base64data });
                };
                reader.readAsDataURL(chunk);
            });
        } else {
            // Text chunk
            console.log(chunk);
            return Promise.resolve({ type: 'text', data: chunk });
        }
    });

    console.log(formattedChunks);

    Promise.all(formattedChunks).then((finalChunks) => {
        // Add the language at the end
        finalChunks.push({ type: 'language', data: language });

        const blob = new Blob([JSON.stringify(finalChunks)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        document.body.appendChild(a);
        a.href = url;
        if (document.getElementById("filename").value === "") {
            a.download = "recording.llmvc";
        } else {
            a.download = document.getElementById("filename").value + ".llmvc";
        }
        a.click();
        window.URL.revokeObjectURL(url);

        chunks = []; // Clear chunks after download
    });
}

function userStartedSpeaking() {
    speechSynthesis.cancel();
    stopGenerating = true;
    // Add your custom functionality here
}

asyncInitChat();