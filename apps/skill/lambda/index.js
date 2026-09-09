import Alexa from 'ask-sdk-core';

// Alexa abandons the skill response at roughly 8s. Waiting 12s guaranteed
// the user heard nothing at all on a slow turn; failing at 6s leaves room to
// speak an apology instead.
const REQUEST_TIMEOUT_MS = 6000;

function fumeApiUrl() {
  return (process.env.FUME_API_URL || '').replace(/\/$/, '');
}

function accessTokenOf(input) {
  return input.context?.System?.user?.accessToken ?? '';
}

async function fumeApi(path, token, body) {
  const API_URL = fumeApiUrl();
  if (!API_URL) throw new Error('FUME_API_URL is not set on the lambda');
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : '{}',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`fume api ${res.status}: ${err}`);
  }
  return res.json();
}

// Must go through responseBuilder. Returning a hand-built { response: {...} }
// gets wrapped by the SDK into { response: { response: {...} } }, which Alexa
// cannot read — the user hears silence instead of the link prompt.
function linkAccountCard(input) {
  return input.responseBuilder
    .speak(
      'Fume needs your Amazon account linked first. Open the Alexa app, find Fume, and tap link account.',
    )
    .withLinkAccountCard()
    .withShouldEndSession(true)
    .getResponse();
}

function openSession(input, text) {
  return input.responseBuilder
    .speak(text)
    .reprompt('Go on. I am listening.')
    .withShouldEndSession(false)
    .getResponse();
}

function endSession(input, text) {
  return input.responseBuilder.speak(text).withShouldEndSession(true).getResponse();
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const token = accessTokenOf(handlerInput.requestEnvelope);
    if (!token) return linkAccountCard(handlerInput);
    try {
      const data = await fumeApi('/v1/open', token);
      return openSession(handlerInput, data.text);
    } catch (e) {
      console.error('open failed', e);
      return endSession(handlerInput, 'Sorry, I could not reach the companion right now.');
    }
  },
};

// Open-ended speech arrives as ChatIntent, whose custom slot carries the raw
// utterance. AMAZON.FallbackIntent cannot do this job: Alexa sends it with no
// slots at all, so there is no way to recover what the user said from it.
const ChatIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'ChatIntent');
  },
  async handle(handlerInput) {
    const input = handlerInput.requestEnvelope;
    const utterance = input.request.intent.slots?.text?.value ?? '';
    const token = accessTokenOf(input);
    if (!token) return linkAccountCard(handlerInput);
    if (!utterance) {
      return openSession(handlerInput, "Sorry, I didn't catch that. Say it again?");
    }
    try {
      const data = await fumeApi('/v1/respond', token, { utterance });
      return openSession(handlerInput, data.text);
    } catch (e) {
      console.error('respond failed', e);
      return openSession(handlerInput, 'Sorry, something glitched. Try again?');
    }
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'AMAZON.FallbackIntent');
  },
  handle(handlerInput) {
    return openSession(handlerInput, "Sorry, I didn't catch that. Say it again?");
  },
};

const NavigateHomeIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'AMAZON.NavigateHomeIntent');
  },
  handle(handlerInput) {
    return openSession(handlerInput, 'Still here. Go on.');
  },
};

const RememberIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'RememberIntent');
  },
  async handle(handlerInput) {
    const token = accessTokenOf(handlerInput.requestEnvelope);
    if (!token) return linkAccountCard(handlerInput);
    try {
      await fumeApi('/v1/memory/pin', token);
      return openSession(handlerInput, 'Got it. I will remember that.');
    } catch (e) {
      console.error('pin failed', e);
      return openSession(handlerInput, 'I could not remember that. Try again?');
    }
  },
};

const ForgetIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'ForgetIntent');
  },
  async handle(handlerInput) {
    const intent = handlerInput.requestEnvelope.request.intent;
    const target = intent.slots?.what?.value ?? undefined;
    const token = accessTokenOf(handlerInput.requestEnvelope);
    if (!token) return linkAccountCard(handlerInput);
    try {
      const data = await fumeApi('/v1/memory/forget', token, { target });
      const n = data.suppressed ?? 0;
      return openSession(
        handlerInput,
        n > 0
          ? `Okay, forgotten ${n} thing${n === 1 ? '' : 's'}.`
          : 'Okay, I will not remember that.',
      );
    } catch (e) {
      console.error('forget failed', e);
      return openSession(handlerInput, 'I could not forget that. Try again?');
    }
  },
};

const RecallIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'RecallIntent');
  },
  async handle(handlerInput) {
    const token = accessTokenOf(handlerInput.requestEnvelope);
    if (!token) return linkAccountCard(handlerInput);
    try {
      const data = await fumeApi('/v1/memory/recall', token);
      const memories = data.memories ?? [];
      if (!memories.length) {
        return openSession(handlerInput, 'I don\'t have much stored about you yet.');
      }
      const top = memories.slice(0, 5).map((m) => m.content).join('. ');
      return openSession(handlerInput, `Here is what I remember about you. ${top}.`);
    } catch (e) {
      console.error('recall failed', e);
      return openSession(handlerInput, 'I could not read my memory right now. Try again?');
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return isIntent(handlerInput, 'AMAZON.HelpIntent');
  },
  handle(handlerInput) {
    return openSession(
      handlerInput,
      'Just keep talking. Fume stays here until you say goodbye or stop.',
    );
  },
};

const EndSessionHandler = {
  canHandle(handlerInput) {
    const intent = handlerInput.requestEnvelope.request.intent;
    return (
      intent &&
      (intent.name === 'AMAZON.CancelIntent' || intent.name === 'AMAZON.StopIntent')
    );
  },
  async handle(handlerInput) {
    const token = accessTokenOf(handlerInput.requestEnvelope);
    if (token) {
      await fumeApi('/v1/close', token).catch(() => undefined);
    }
    return endSession(handlerInput, 'Goodbye. I will be here when you come back.');
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  async handle(handlerInput) {
    const token = accessTokenOf(handlerInput.requestEnvelope);
    if (token) {
      await fumeApi('/v1/close', token).catch(() => undefined);
    }
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('skill error', error);
    return endSession(
      handlerInput,
      'Sorry, something went wrong. Open Fume again to continue.',
    );
  },
};

function isIntent(handlerInput, name) {
  const request = handlerInput.requestEnvelope.request;
  return request.type === 'IntentRequest' && request.intent?.name === name;
}

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ChatIntentHandler,
    FallbackIntentHandler,
    NavigateHomeIntentHandler,
    RememberIntentHandler,
    ForgetIntentHandler,
    RecallIntentHandler,
    HelpIntentHandler,
    EndSessionHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
