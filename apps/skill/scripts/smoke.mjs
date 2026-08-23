import { handler } from '../lambda/index.mjs';

process.env.FUME_API_URL = process.env.FUME_API_URL ?? 'http://localhost:3000';

const TOKEN = 'dev';

function envelope(request, sessionId = 'smoke-1', sessionNew = false) {
  return {
    version: '1.0',
    session: {
      new: sessionNew,
      sessionId,
      application: { applicationId: 'smoke-app' },
      user: { userId: 'smoke-user', accessToken: TOKEN },
    },
    context: {
      System: {
        application: { applicationId: 'smoke-app' },
        user: { userId: 'smoke-user', accessToken: TOKEN },
      },
    },
    request,
  };
}

function speechOf(response) {
  return (
    response?.outputSpeech?.text ??
    response?.response?.outputSpeech?.text ??
    response?.response?.outputSpeech?.ssml ??
    ''
  )
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function invoke(evt) {
  return new Promise((resolve, reject) => {
    handler(evt, {}, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

let sessionId = 'smoke-1';
const launch = await invoke(
  envelope(
    {
      type: 'LaunchRequest',
      requestId: `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
      locale: 'en-US',
    },
    sessionId,
    true,
  ),
);
console.log('LAUNCH:', speechOf(launch));

const askEvent = (intentName, slots = {}) =>
  envelope(
    {
      type: 'IntentRequest',
      requestId: `req-${Date.now()}`,
      timestamp: new Date().toISOString(),
      locale: 'en-US',
      intent: { name: intentName, confirmationStatus: 'NONE', slots },
    },
    sessionId,
  );

const turn1 = await invoke(
  askEvent('AMAZON.FallbackIntent', {
    text: { name: 'text', value: 'I like chai tea and want to name my companion Fume' },
  }),
);
console.log('TURN1:', speechOf(turn1));

const turn2 = await invoke(
  askEvent('AMAZON.FallbackIntent', {
    text: { name: 'text', value: 'What is my favorite drink?' },
  }),
);
console.log('TURN2:', speechOf(turn2));

const remember = await invoke(askEvent('RememberIntent'));
console.log('REMEMBER:', speechOf(remember));

const recall = await invoke(askEvent('RecallIntent'));
console.log('RECALL:', speechOf(recall));

const goodbye = await invoke(askEvent('AMAZON.StopIntent'));
console.log('GOODBYE:', speechOf(goodbye), '| shouldEndSession:', goodbye?.response?.shouldEndSession);
